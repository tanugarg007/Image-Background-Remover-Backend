import { Request, Response } from "express";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BackgroundChanger } from "../models/backgroundchangermodel";

const backgroundImagesDir = path.resolve(process.cwd(), "uploads", "background-changer");

export const saveBackground = async (
  req: Request,
  res: Response
): Promise<void> => {
  let savedFilePath: string | undefined;
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Final image is required.",
      });
      return;
    }

    if (req.file.mimetype !== "image/png") {
      res.status(400).json({
        success: false,
        message: "Final image must be a PNG file.",
      });
      return;
    }

    const selectedColor = String(req.body.selectedColor || "");

    if (!/^#[0-9a-fA-F]{6}$/.test(selectedColor)) {
      res.status(400).json({
        success: false,
        message: "A valid background color is required.",
      });
      return;
    }

    await mkdir(backgroundImagesDir, { recursive: true });
    const outputFileName = `${randomUUID()}.png`;
    savedFilePath = path.join(backgroundImagesDir, outputFileName);
    await writeFile(savedFilePath, req.file.buffer);

    const requestedName = path.parse(path.basename(String(req.body.originalFileName || "image"))).name;
    const record = await BackgroundChanger.create({
      originalFileName: String(req.body.originalFileName || "image"),
      outputFileName: `${requestedName}-background.png`,
      imagePath: path.join("uploads", "background-changer", outputFileName),
      selectedColor,
    });

    res.status(201).json({
      success: true,
      message: "Background image saved successfully.",
      data: record,
    });
  } catch (error) {
    if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);
    console.error("Save background error:", error);

    res.status(500).json({
      success: false,
      message: "Could not save background image.",
    });
  }
};

export const downloadBackground = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const record = await BackgroundChanger.findById(req.params.id);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Image not found.",
      });
      return;
    }

    const filePath = path.join(backgroundImagesDir, path.basename(record.imagePath));

    res.download(filePath, record.outputFileName, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({
          success: false,
          message: "Image file not found.",
        });
      }
    });
  } catch (error) {
    console.error("Download background error:", error);

    res.status(500).json({
      success: false,
      message: "Could not download image.",
    });
  }
};
