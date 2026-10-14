import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageCropper } from "../models/imagecroppermodel";

const croppedImagesDir = path.resolve(process.cwd(), "uploads", "cropped-images");

export const saveCroppedImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  let savedFilePath: string | undefined;
  try {
    const body = (req.body ?? {}) as Record<string, string>;
    const originalFileName = body.originalFileName?.trim();
    const originalFormat = body.originalFormat?.trim();
    const aspectRatio = body.aspectRatio?.trim();
    const values = {
      originalSize: Number(body.originalSize),
      width: Number(body.width),
      height: Number(body.height),
      cropX: Number(body.cropX),
      cropY: Number(body.cropY),
      cropWidth: Number(body.cropWidth),
      cropHeight: Number(body.cropHeight),
    };

    if (
      !req.file || req.file.mimetype !== "image/png" ||
      !originalFileName || !originalFormat || !aspectRatio ||
      !Object.values(values).every(Number.isFinite) ||
      values.originalSize <= 0 || values.width <= 0 || values.height <= 0 ||
      values.cropX < 0 || values.cropY < 0 ||
      values.cropWidth <= 0 || values.cropHeight <= 0
    ) {
      res.status(400).json({ message: "Upload the cropped PNG and provide valid crop details." });
      return;
    }

    await mkdir(croppedImagesDir, { recursive: true });
    const storedFileName = `${randomUUID()}.png`;
    savedFilePath = path.join(croppedImagesDir, storedFileName);
    await writeFile(savedFilePath, req.file.buffer);

    const croppedFileName = `${path.parse(path.basename(originalFileName)).name || "image"}-cropped.png`;
    const record = await ImageCropper.create({
      originalFileName: path.basename(originalFileName),
      croppedFileName,
      storedFileName,
      originalFormat,
      croppedFormat: "image/png",
      originalSize: values.originalSize,
      croppedSize: req.file.size,
      width: values.width,
      height: values.height,
      cropX: values.cropX,
      cropY: values.cropY,
      cropWidth: values.cropWidth,
      cropHeight: values.cropHeight,
      aspectRatio,
    });

    res.status(201).json({
      message: "Cropped image saved successfully.",
      data: record,
    });
  } catch (error: unknown) {
    if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);
    res.status(500).json({
      message: "Unable to save the cropped image.",
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  }
};

export const downloadCroppedImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const record = await ImageCropper.findById(req.params.id);
    if (!record) {
      res.status(404).json({ message: "Cropped image not found." });
      return;
    }

    const filePath = path.join(croppedImagesDir, path.basename(record.storedFileName));
    res.setHeader("Cache-Control", "no-store");
    res.download(filePath, path.basename(record.croppedFileName));
  } catch {
    res.status(500).json({ message: "Unable to download the cropped image." });
  }
};
