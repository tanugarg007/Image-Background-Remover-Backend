import { Request, Response } from "express";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(
  process.cwd(),
  "uploads",
  "removed-backgrounds"
);

// Kept for compatibility with images created by older backend deployments.
export const backgrounddownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename)
      ? rawFilename[0]
      : rawFilename;

    if (!filename || !/^background-[a-zA-Z0-9-]+\.png$/.test(filename)) {
      res.status(400).json({
        success: false,
        message: "Invalid image filename.",
      });
      return;
    }

    const filePath = path.join(outputDir, filename);
    let fileStats;

    try {
      fileStats = await fs.stat(filePath);
    } catch {
      res.status(404).json({
        success: false,
        message: "Processed image not found.",
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    const imageStream = createReadStream(filePath);
    imageStream.on("error", (error) => {
      console.error("[Download] Stream failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to download image.",
        });
      } else {
        res.destroy(error);
      }
    });
    imageStream.pipe(res);
  } catch (error) {
    console.error("[Download] Failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Download failed.",
      });
    }
  }
};
