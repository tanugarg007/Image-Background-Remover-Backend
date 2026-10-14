import { Request, Response } from "express";
import path from "node:path";
import ImageCompressor from "../models/imagecompressermodel";

export const Imagecompressor = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    const image = await ImageCompressor.create({
      url,
      compressedUrl: req.file.filename,
      quality: Number(quality),
      width: Number(width),
      height: Number(height),
      originalSize: Number(originalSize),
      compressedSize: req.file.size,
      reducedSize: Number(originalSize) - req.file.size,
    });

    res.status(201).json({
      message: "Image saved successfully.",
      id: image._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save image." });
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
      "uploads/compressed-images",
      path.basename(image.compressedUrl)
    );

    res.download(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Download failed." });
  }
};
