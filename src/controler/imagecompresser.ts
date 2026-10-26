import { Request, Response } from "express";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import ImageCompressor from "../models/imagecompressermodel";

const compressedImagesDir = path.resolve(process.cwd(), "uploads", "compressed-images");

export const Imagecompressor = async (
  req: Request,
  res: Response
): Promise<void> => {
  let savedFilePath: string | undefined;
  let recordId: string | undefined;
  try {
    if (!req.file) {
      res.status(400).json({ message: "Please upload an image." });
      return;
    }

    const {
      url,
      quality,
      width,
      height,
      originalSize,
    } = req.body;

    const qualityValue = Number(quality);
    const widthValue = Number(width);
    const heightValue = Number(height);
    const originalSizeValue = Number(originalSize);
    if (!url || !Number.isInteger(qualityValue) || qualityValue < 1 || qualityValue > 100 ||
      !Number.isFinite(widthValue) || widthValue < 1 || !Number.isFinite(heightValue) || heightValue < 1 ||
      !Number.isFinite(originalSizeValue) || originalSizeValue < 0) {
      res.status(400).json({ message: "Please provide valid compression details." });
      return;
    }

    await mkdir(compressedImagesDir, { recursive: true });
    const storedFileName = `${randomUUID()}${path.extname(req.file.originalname) || ".jpg"}`;
    savedFilePath = path.join(compressedImagesDir, storedFileName);
    await writeFile(savedFilePath, req.file.buffer);

    const image = await ImageCompressor.create({
      url,
      compressedUrl: storedFileName,
      quality: qualityValue,
      width: widthValue,
      height: heightValue,
      originalSize: originalSizeValue,
      compressedSize: req.file.size,
      reducedSize: Math.max(0, originalSizeValue - req.file.size),
    });
    recordId = String(image._id);

    res.status(201).json({
      message: "Image saved successfully.",
      data: image,
    });
  } catch (error) {
    if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);
    if (recordId) await ImageCompressor.findByIdAndDelete(recordId).catch(() => undefined);
    console.error("Failed to save compressed image:", error);
    res.status(500).json({
      message: "Failed to save compressed image.",
      ...(process.env.NODE_ENV !== "production" && {
        detail: error instanceof Error ? error.message : String(error),
      }),
    });
  }
};

export const downloadCompressedImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const image = await ImageCompressor.findById(req.params.id);

    if (!image) {
      res.status(404).json({ message: "Image not found." });
      return;
    }

    const filePath = path.resolve(
      compressedImagesDir,
      path.basename(image.compressedUrl)
    );

    res.download(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Download failed." });
  }
};
