
import { Request, Response } from "express";
import mongoose from "mongoose";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { ImageControl } from "../models/imagequalitycontrolmodel";

const getUploadDirectory = () =>
  path.resolve(process.cwd(), "uploads", "compressed-images");

const getExtension = (format: string) =>
  format === "JPG" ? "jpg" : format.toLowerCase();

// SAVE IMAGE + HISTORY
export const createImageControl = async (
  req: Request,
  res: Response
): Promise<void> => {
  let recordId: string | undefined;
  let savedFilePath: string | undefined;

  try {
    const image = req.file;

    if (!image) {
      res.status(400).json({
        success: false,
        message: "Please upload a compressed image.",
      });
      return;
    }

    const {
      imageName,
      originalFormat,
      outputFormat,
    } = req.body;

    const quality = Number(req.body.quality);
    const width = Number(req.body.width);
    const height = Number(req.body.height);
    const maxWidth = Number(req.body.maxWidth ?? 0);
    const originalSize = Number(req.body.originalSize);
    const compressedSize = Number(req.body.compressedSize);

    const mimeTypes: Record<string, string> = {
      WEBP: "image/webp",
      JPG: "image/jpeg",
      PNG: "image/png",
    };

    if (
      !imageName ||
      !originalFormat ||
      !mimeTypes[outputFormat] ||
      image.mimetype !== mimeTypes[outputFormat] ||
      !Number.isFinite(quality) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(maxWidth) ||
      !Number.isFinite(originalSize) ||
      !Number.isFinite(compressedSize) ||
      quality < 10 ||
      quality > 100 ||
      width < 1 ||
      height < 1 ||
      maxWidth < 0 ||
      originalSize < 0 ||
      compressedSize < 0
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid compression details.",
      });
      return;
    }

    const reducedSize =
      originalSize > 0
        ? Number(
            (((originalSize - compressedSize) / originalSize) * 100).toFixed(2)
          )
        : 0;

    const record = await ImageControl.create({
      imageName: path.basename(imageName),
      originalFormat,
      outputFormat,
      quality,
      width,
      height,
      maxWidth,
      originalSize,
      compressedSize,
      reducedSize,
    });

    recordId = String(record._id);

    const uploadDirectory = getUploadDirectory();
    await fs.mkdir(uploadDirectory, { recursive: true });

    savedFilePath = path.join(
      uploadDirectory,
      `${recordId}.${getExtension(outputFormat)}`
    );

    await fs.writeFile(savedFilePath, image.buffer);

    res.status(201).json({
      success: true,
      message: "Image and history saved successfully.",
      data: record,
    });
  } catch (error) {
    if (savedFilePath) {
      await fs.unlink(savedFilePath).catch(() => {});
    }

    if (recordId) {
      await ImageControl.findByIdAndDelete(recordId).catch(() => {});
    }

    console.error("Save compression error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save compressed image.",
    });
  }
};

// GET ALL HISTORY
export const getImageControls = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const records = await ImageControl.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch compression history.",
    });
  }
};

// GET HISTORY BY ID
export const getImageControlById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid record ID.",
      });
      return;
    }

    const record = await ImageControl.findById(id);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Compression record not found.",
      });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.status(200).json({ success: true, data: record });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch compression record.",
    });
  }
};

// UPDATE HISTORY

export const updateImageControl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid record ID.",
      });
      return;
    }

    const record = await ImageControl.findById(id);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Compression record not found.",
      });
      return;
    }

    const allowedFields = [
      "imageName",
      "originalFormat",
      "outputFormat",
      "quality",
      "width",
      "height",
      "maxWidth",
      "originalSize",
      "compressedSize",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Please provide fields to update.",
      });
      return;
    }

    if (
      updates.outputFormat !== undefined &&
      !["WEBP", "JPG", "PNG"].includes(
        String(updates.outputFormat)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid output format.",
      });
      return;
    }

    const originalSize =
      updates.originalSize !== undefined
        ? Number(updates.originalSize)
        : record.originalSize;

    const compressedSize =
      updates.compressedSize !== undefined
        ? Number(updates.compressedSize)
        : record.compressedSize;

    if (
      !Number.isFinite(originalSize) ||
      !Number.isFinite(compressedSize) ||
      originalSize < 0 ||
      compressedSize < 0
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid image sizes.",
      });
      return;
    }

    updates.reducedSize =
      originalSize > 0
        ? Number(
            (
              ((originalSize - compressedSize) / originalSize) *
              100
            ).toFixed(2)
          )
        : 0;

    // Check whether any supplied value actually changes
    const hasChanges = Object.entries(updates).some(
      ([key, value]) =>
        key === "reducedSize"
          ? false
          : String(value) !== String(
              record.get(key as keyof typeof record)
            )
    );

    if (!hasChanges) {
      res.status(200).json({
        success: true,
        updated: false,
        message: "No changes detected. Record was not updated.",
        data: record,
      });
      return;
    }

    const updatedImage = await ImageControl.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedImage) {
      res.status(404).json({
        success: false,
        message: "Compression record not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      updated: true,
      message: "Image record updated successfully.",
      data: updatedImage,
    });
  } catch (error) {
    console.error("Update image control error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update compression record.",
    });
  }
};


// DELETE HISTORY
export const deleteImageControl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid record ID.",
      });
      return;
    }

    const record = await ImageControl.findByIdAndDelete(id);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Compression record not found.",
      });
      return;
    }

    const filePath = path.join(
      getUploadDirectory(),
      `${record._id}.${getExtension(record.outputFormat)}`
    );

    await fs.unlink(filePath).catch(() => {});

    res.status(200).json({
      success: true,
      message: "Compression record deleted successfully.",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to delete compression record.",
    });
  }
};

// DOWNLOAD IMAGE
export const downloadImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid image ID.",
      });
      return;
    }

    const record = await ImageControl.findById(id);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Image record not found.",
      });
      return;
    }

    const extension = getExtension(record.outputFormat);
    const filePath = path.join(
      getUploadDirectory(),
      `${record._id}.${extension}`
    );

    if (!existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: "Compressed image file not found on the server.",
      });
      return;
    }

    res.download(
      filePath,
      `${path.parse(record.imageName).name}-optimized.${extension}`
    );
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to download image.",
    });
  }
};
