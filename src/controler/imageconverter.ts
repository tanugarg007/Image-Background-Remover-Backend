import { Request, Response } from "express";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ImageConverter as ImageConverterModel } from "../models/imageconvertermodel";

const convertedImagesDir = path.resolve(process.cwd(), "uploads", "converted-images");

interface IImageConverterRequest {
  originalFileName: string;
  convertedFileName: string;
  originalFormat: string;
  convertedFormat: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
}

export const ImageConverter = async (
  req: Request,
  res: Response
): Promise<void> => {
  let savedFilePath: string | undefined;
  try {
    const {
      originalFileName,
      convertedFileName: converterFileName,
      originalFormat,
      convertedFormat: converterFormat,
      originalSize,
      convertedSize: converterSize,
      width,
      height,
    } = (req.body ?? {}) as IImageConverterRequest;

    const parsedOriginalSize = Number(originalSize);
    const parsedConvertedSize = Number(converterSize);
    const parsedWidth = Number(width);
    const parsedHeight = Number(height);
    const quality = Number(((req.body ?? {}) as Record<string, string>).quality ?? 90);
    const formatExtensions: Record<string, string> = {
      png: ".png",
      jpg: ".jpg",
      jpeg: ".jpg",
      webp: ".webp",
      avif: ".avif",
    };
    const extension = converterFormat?.trim()
      ? formatExtensions[converterFormat.trim().toLowerCase()]
      : undefined;

    if (
      !req.file ||
      !originalFileName?.trim() ||
      !converterFileName?.trim() ||
      !originalFormat?.trim() ||
      !converterFormat?.trim() ||
      !extension ||
      !Number.isFinite(parsedOriginalSize) || parsedOriginalSize <= 0 ||
      !Number.isFinite(parsedConvertedSize) || parsedConvertedSize <= 0 ||
      (converterFormat.trim().toLowerCase() !== "avif" && parsedConvertedSize !== req.file.size) ||
      !Number.isFinite(parsedWidth) || parsedWidth <= 0 ||
      !Number.isFinite(parsedHeight) || parsedHeight <= 0
      || !Number.isInteger(quality) || quality < 1 || quality > 100
    ) {
      res.status(400).json({ message: "Upload the converted image and provide valid image details." });
      return;
    }

    const convertedBuffer = converterFormat.trim().toLowerCase() === "avif"
      ? await sharp(req.file.buffer).avif({ quality }).toBuffer()
      : req.file.buffer;

    if (converterFormat.trim().toLowerCase() !== "avif" && parsedConvertedSize !== req.file.size) {
      res.status(400).json({ message: "Converted size must match the uploaded image." });
      return;
    }

    await mkdir(convertedImagesDir, { recursive: true });
    const storedFileName = `${randomUUID()}${extension}`;
    savedFilePath = path.join(convertedImagesDir, storedFileName);
    await writeFile(savedFilePath, convertedBuffer);

    const imageRecord = await ImageConverterModel.create({
      originalFileName: originalFileName.trim(),
      convertedFileName: converterFileName.trim(),
      storedFileName,
      originalFormat: originalFormat.trim(),
      convertedFormat: converterFormat.trim(),
      originalSize: parsedOriginalSize,
      convertedSize: convertedBuffer.length,
      width: parsedWidth,
      height: parsedHeight,
    });

    res.status(201).json({
      message: "Image conversion details saved successfully.",
      data: imageRecord,
    });
  } catch (error: unknown) {
    if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);
    res.status(500).json({
      message: "Unable to save image conversion details.",
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  }
};


export const downloadimage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const image = await ImageConverterModel.findById(req.params.id);

    if (!image?.storedFileName) {
      res.status(404).json({
        message: "Converted image not found.",
      });
      return;
    }

    const filePath = path.join(convertedImagesDir, path.basename(image.storedFileName));

    res.setHeader("Cache-Control", "no-store");
    res.download(filePath, path.basename(image.convertedFileName));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to download converted image.",
    });
  }
};
