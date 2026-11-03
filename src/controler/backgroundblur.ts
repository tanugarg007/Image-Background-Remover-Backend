import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Types } from "mongoose";
import sharp from "sharp";
import { BackgroundBlur } from "../models/backgroundblurmodel";

const blurredImagesDir = path.resolve(process.cwd(), "uploads", "background-blur");

type BackgroundBlurFiles = {
  image?: Express.Multer.File[];
  subject?: Express.Multer.File[];
};

export const createBackgroundBlur = async (
  req: Request,
  res: Response
): Promise<void> => {
  let savedFilePath: string | undefined;
  try {
    const files = req.files as BackgroundBlurFiles | undefined;
    const originalImage = files?.image?.[0];
    const foregroundSubject = files?.subject?.[0];

    if (!originalImage || !foregroundSubject) {
      res.status(400).json({
        success: false,
        message: "Upload the original image and its transparent subject image.",
      });
      return;
    }

    const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!supportedImageTypes.has(originalImage.mimetype) || foregroundSubject.mimetype !== "image/png") {
      res.status(400).json({
        success: false,
        message: "Upload a supported original image and a transparent PNG subject.",
      });
      return;
    }

    const blurStrength = Number(req.body.blurStrength);
    if (!Number.isFinite(blurStrength) || blurStrength < 2 || blurStrength > 32) {
      res.status(400).json({
        success: false,
        message: "Blur strength must be between 2 and 32.",
      });
      return;
    }

    let imageMetadata: sharp.Metadata;
    try {
      imageMetadata = await sharp(originalImage.buffer).metadata();
    } catch {
      res.status(400).json({
        success: false,
        message: "The original image file is invalid or unsupported.",
      });
      return;
    }
    if (!imageMetadata.width || !imageMetadata.height) {
      res.status(400).json({
        success: false,
        message: "Could not read the original image dimensions.",
      });
      return;
    }

    const blurredBackground = await sharp(originalImage.buffer)
      .blur(blurStrength)
      .png()
      .toBuffer();
    const alignedSubject = await sharp(foregroundSubject.buffer)
      .resize(imageMetadata.width, imageMetadata.height, { fit: "fill" })
      .png()
      .toBuffer();
    const result = await sharp(blurredBackground)
      .composite([{ input: alignedSubject }])
      .png()
      .toBuffer();

    const fileBaseName = path.parse(path.basename(originalImage.originalname)).name
      .replace(/[^a-zA-Z0-9_-]/g, "-") || "image";
    const outputFileName = `${fileBaseName}-background-blur.png`;
    const storedFileName = `${randomUUID()}.png`;

    await mkdir(blurredImagesDir, { recursive: true });
    savedFilePath = path.join(blurredImagesDir, storedFileName);
    await writeFile(savedFilePath, result);

    const record = await BackgroundBlur.create({
      originalFileName: path.basename(originalImage.originalname),
      outputFileName,
      storedFileName,
      blurStrength,
      originalSize: originalImage.size,
      outputSize: result.length,
      width: imageMetadata.width,
      height: imageMetadata.height,
    });

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        fileName: record.outputFileName,
      },
    });
  } catch (error) {
    if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);
    console.error("Background blur error:", error);
    res.status(500).json({
      success: false,
      message: "Could not create the blurred background image.",
    });
  }
};


export const backgrounddownload = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid background blur ID." });
      return;
    }

    const record = await BackgroundBlur.findById(id);
    if (!record) {
      res.status(404).json({ success: false, message: "Background blur image not found." });
      return;
    }

    const filePath = path.join(blurredImagesDir, path.basename(record.storedFileName));
    res.setHeader("Cache-Control", "no-store");
    res.download(filePath, path.basename(record.outputFileName), (error) => {
      if (error && !res.headersSent) {
        console.error("Background blur download error:", error);
        res.status(404).json({
          success: false,
          message: "Background blur image file not found.",
        });
      }
    });
  } catch (error) {
    console.error("Background download error:", error);
    res.status(500).json({
      success: false,
      message: "Could not download the blurred background image.",
    });
  }
};    
