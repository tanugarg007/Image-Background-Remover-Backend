
import { Request, Response } from "express";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ImageAnalyzer } from "../models/imageanalyzermodel";
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

const getAspectRatio = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

// POST: Analyze and save image
export const AnalyzeImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Please select an image.",
      });
      return;
    }

    if (!file.mimetype.startsWith("image/")) {
      res.status(415).json({
        success: false,
        message: "Only image files are allowed.",
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      res.status(413).json({
        success: false,
        message: "Image size must be 25 MB or less.",
      });
      return;
    }

    const info = await sharp(file.buffer).metadata();

    if (!info.width || !info.height || !info.format) {
      res.status(400).json({
        success: false,
        message: "Unable to analyze this image.",
      });
      return;
    }

    const depthLabels: Record<string, string> = {
      uchar: "8-bit per channel", char: "8-bit per channel",
      ushort: "16-bit per channel", short: "16-bit per channel",
      uint: "32-bit per channel", int: "32-bit per channel",
      float: "32-bit floating point",
    };
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const megapixels = Number(((info.width * info.height) / 1_000_000).toFixed(2));
    const colorDepth = depthLabels[info.depth || ""] || info.depth || "Unknown";
    const colorSpace = info.space || "Unknown";
    const orientation = info.width >= info.height ? "Landscape" : "Portrait";
    const imageDetails = {
      fileName: file.originalname,
      url: "",
      contentHash,
      format: info.format.toUpperCase(),
      mimeType: file.mimetype,
      fileSize: file.size,
      width: info.width,
      height: info.height,
      aspectRatio: getAspectRatio(info.width, info.height),
      colorMode: colorSpace,
      hasTransparency: info.hasAlpha || false,
      metadata: {
        megapixels,
        colorSpace,
        channels: info.channels || 1,
        colorDepth,
        orientation,
        exifOrientation: info.orientation,
      },
      analyzedAt: new Date(),
    };
    const image = await ImageAnalyzer.findOneAndUpdate(
      { contentHash },
      { $set: imageDetails },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    res.status(201).json({
      success: true,
      message: "Image analyzed. Existing records are updated for duplicate files.",
      data: {
        ...image.toObject(),
        megapixels,
        colorSpace,
        channels: info.channels || 1,
        colorDepth,
        orientation,
        hasAlpha: info.hasAlpha || false,
      },
    });
  } catch (error) {
    console.error("Image analysis failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to analyze image.",
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  }
};

// GET: Fetch all analyzed images
export const GetImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const images = await ImageAnalyzer.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: images,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to fetch images.",
    });
  }
};

// GET: Fetch one image by ID
export const GetImageById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const image = await ImageAnalyzer.findById(req.params.id);

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: image,
    });
  } catch {
    res.status(400).json({
      success: false,
      message: "Invalid image ID.",
    });
  }
};

// PATCH: Update saved image details
export const UpdateImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const allowedFields = [
      "name",
      "format",
      "size",
      "width",
      "height",
      "megapixels",
      "colorSpace",
      "channels",
      "colorDepth",
      "orientation",
      "exifOrientation",
      "hasAlpha",
      "lastModified",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const image = await ImageAnalyzer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Image updated successfully.",
      data: image,
    });
  } catch {
    res.status(400).json({
      success: false,
      message: "Unable to update image.",
    });
  }
};

// DELETE: Delete saved image record
export const DeleteImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const image = await ImageAnalyzer.findByIdAndDelete(
      req.params.id
    );

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Image record deleted successfully.",
    });
  } catch {
    res.status(400).json({
      success: false,
      message: "Invalid image ID.",
    });
  }
};
