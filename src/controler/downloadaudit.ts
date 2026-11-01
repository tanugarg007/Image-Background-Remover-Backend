import { Request, Response } from "express";
import { Types } from "mongoose";
import path from "node:path";
import DownloadAudit from "../models/downloadauditmodel";
import { DownloadOptions } from "../models/downloadzipmodel";
import { getSessionUser } from "../midleware/sessionuser";

export const recordDownloadActivity = async (req: Request, res: Response): Promise<void> => {
  const { tool, fileName, fileSize } = (req.body ?? {}) as {
    tool?: unknown;
    fileName?: unknown;
    fileSize?: unknown;
  };

  if (
    typeof tool !== "string" || !tool.trim() || tool.trim().length > 120 ||
    typeof fileName !== "string" || !fileName.trim() || fileName.length > 255 ||
    (fileSize !== undefined && (!Number.isFinite(fileSize) || Number(fileSize) < 0))
  ) {
    res.status(400).json({ success: false, message: "Provide a valid tool and file name." });
    return;
  }

  try {
    const user = await getSessionUser(req);
    await DownloadAudit.create({
      ...(user ? { userId: new Types.ObjectId(user.id) } : {}),
      userEmail: user?.email || "Guest",
      userName: user?.name || user?.email || "Guest",
      userRole: user?.role || "guest",
      tool: tool.trim(),
      fileName: path.basename(fileName.trim()),
      ...(typeof fileSize === "number" ? { fileSize } : {}),
      downloadedAt: new Date(),
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("[Download audit] Could not record activity:", error);
    res.status(500).json({ success: false, message: "Could not record download activity." });
  }
};

export const getAdminDownloadActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Superadmin access is required." });
      return;
    }

    const [activities, zipDownloads] = await Promise.all([
      DownloadAudit.find().lean(),
      DownloadOptions.find().lean(),
    ]);
    const downloads = [
      ...activities.map((item) => ({ ...item, source: "activity" as const })),
      ...zipDownloads.map((item) => ({
        _id: item._id,
        source: "zip" as const,
        userId: item.userId,
        userEmail: item.userEmail || "Guest",
        userName: item.userName || item.userEmail || "Guest",
        userRole: item.userRole || "guest",
        tool: "Downloads (ZIP)",
        fileName: item.zipName,
        fileSize: item.totalSize,
        totalFiles: item.totalFiles,
        files: item.files,
        downloadedAt: item.downloadedAt,
      })),
    ].sort((first, second) => second.downloadedAt.getTime() - first.downloadedAt.getTime());
    res.status(200).json({ success: true, count: downloads.length, data: downloads });
  } catch (error) {
    console.error("[Download audit] Could not load activity:", error);
    res.status(500).json({ success: false, message: "Could not load download activity." });
  }
};

export const deleteAdminDownloadActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Superadmin access is required." });
      return;
    }

    const { id } = req.params;
    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid download activity ID." });
      return;
    }

    const source = req.query.source;
    if (source !== "activity" && source !== "zip") {
      res.status(400).json({ success: false, message: "Choose an activity or ZIP history record." });
      return;
    }

    const result = source === "zip"
      ? await DownloadOptions.findByIdAndDelete(id)
      : await DownloadAudit.findByIdAndDelete(id);
    if (!result) {
      res.status(404).json({ success: false, message: "Download activity was not found." });
      return;
    }
    res.status(200).json({ success: true, message: "Download activity removed." });
  } catch (error) {
    console.error("[Download audit] Could not delete activity:", error);
    res.status(500).json({ success: false, message: "Could not remove download activity." });
  }
};
