
import { Request, Response } from "express";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  removeBackground as removeImageBackground,
} from "@imgly/background-removal-node";

const outputDir = path.resolve(
  process.cwd(),
  "uploads",
  "removed-backgrounds"
);

// 1. Remove background and save PNG
export const removeBackground = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log("[Background] Request received");

  try {
    if (!req.file) {
      console.warn("[Background] No image uploaded");
      res.status(400).json({
        message: "Please upload an image.",
      });
      return;
    }

    console.log("[Background] Image received:", {
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({
        message: "Please upload a valid image.",
      });
      return;
    }

    const imageBlob = new Blob(
      [new Uint8Array(req.file.buffer)],
      { type: req.file.mimetype }
    );

    console.log("[Background] Starting image processing");

    const result = await removeImageBackground(imageBlob, {
      model: "small",
      output: { format: "image/png" },
      progress: (key, current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        console.log(`[Background] ${key}: ${percent}%`);
      },
    });

    console.log("[Background] Processing completed");

    const outputBuffer = Buffer.from(
      await result.arrayBuffer()
    );

    await fs.mkdir(outputDir, { recursive: true });

    const filename = `background-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.png`;

    const filePath = path.join(outputDir, filename);

    await fs.writeFile(filePath, outputBuffer);

    console.log("[Background] File saved:", filename);

    res.status(200).json({
      success: true,
      message: "Background removed successfully.",
      filename,
      downloadUrl: `/users/backgrounddownload/${filename}`,
    });
  } catch (error: unknown) {
    console.error("[Background] Processing failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Background removal failed.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
};

// 2. Download processed PNG
export const backgrounddownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
   const rawFilename = req.params.filename;

const filename = Array.isArray(rawFilename)
  ? rawFilename[0]
  : rawFilename;

    if (
      !filename ||
      !/^background-[a-zA-Z0-9-]+\.png$/.test(filename)
    ) {
      res.status(400).json({
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
        message: "Processed image not found.",
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "no-store");

    const imageStream = createReadStream(filePath);

    imageStream.on("error", (error) => {
      console.error("[Download] Stream failed:", error);

      if (!res.headersSent) {
        res.status(500).json({
          message: "Unable to download image.",
        });
      } else {
        res.destroy(error);
      }
    });

    imageStream.pipe(res);
  } catch (error: unknown) {
    console.error("[Download] Failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Download failed.",
      });
    }
  }
};
