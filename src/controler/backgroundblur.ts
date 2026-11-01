import { Request, Response } from "express";
import path from "node:path";
import sharp from "sharp";

type BackgroundBlurFiles = {
  image?: Express.Multer.File[];
  subject?: Express.Multer.File[];
};

export const createBackgroundBlur = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", result.length);
    res.setHeader("Content-Disposition", `attachment; filename="${fileBaseName}-background-blur.png"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(result);
  } catch (error) {
    console.error("Background blur error:", error);
    res.status(500).json({
      success: false,
      message: "Could not create the blurred background image.",
    });
  }
};
