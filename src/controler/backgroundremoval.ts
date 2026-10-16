
import { Request, Response } from "express";
import { createReadStream } from "node:fs";
import {
  removeBackground as removeImageBackground,
} from "@imgly/background-removal-node";
import fs from "node:fs/promises";
import path from "node:path";

// Folder where processed images will be saved
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
  try {
    if (!req.file) {
      res.status(400).json({
        message: "Please upload an image.",
      });
      return;
    }

    const imageBlob = new Blob(
      [new Uint8Array(req.file.buffer)],
      { type: req.file.mimetype }
    );

    const result = await removeImageBackground(imageBlob, {
      model: "medium",
      output: { format: "image/png" },
    });

    const outputBuffer = Buffer.from(
      await result.arrayBuffer()
    );

    await fs.mkdir(outputDir, { recursive: true });

    // Unique filename to avoid overwriting files
    const filename = `background-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.png`;

    const filePath = path.join(outputDir, filename);

    await fs.writeFile(filePath, outputBuffer);

    res.status(200).json({
      success: true,
      message: "Background removed successfully.",
      filename,
      downloadUrl: `/users/backgrounddownload/${filename}`,
    });
  } catch (error: unknown) {
    console.error("Background removal failed:", error);

    res.status(500).json({
      message: "Background removal failed.",
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
};

// 2. Download processed PNG
export const backgrounddownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;

    // Accept only generated PNG filenames
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

    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({
        message: "Processed image not found.",
      });
      return;
    }

    const fileStats = await fs.stat(filePath);
    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const imageStream = createReadStream(filePath);
    imageStream.on("error", (error) => {
      console.error("Download failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Unable to download image." });
      } else {
        res.destroy(error);
      }
    });
    imageStream.pipe(res);
  } catch (error: unknown) {
    console.error("Download failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Download failed.",
      });
    }
  }
};
