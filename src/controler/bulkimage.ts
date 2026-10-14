
import { Request, Response } from "express";
import { BulkImage, IBulkImageItem } from "../models/bulkimagemodel";
import path from "node:path";
import fs from "node:fs";

export const Bulkimage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = req.body;
    const images: IBulkImageItem[] = Array.isArray(body.images)
      ? body.images
      : [
          {
            originalFileName: body.originalFileName,
            originalFormat: body.originalFormat,
            originalSize: body.originalSize,
            originalImageUrl: body.originalImageUrl,
            convertedFileName: body.processedFileName,
            convertedFormat: body.processedFormat,
            convertedSize: body.processedSize,
            processedImageUrl: body.processedImageUrl,
            status: body.status || "completed",
          },
        ];

    const bulkImage = await BulkImage.create({
      images,
      totalImages: body.totalImages || images.length,
      status: body.status || "completed",
      successCount: body.successCount ?? images.filter((image) => image.status === "completed").length,
      failedCount: body.failedCount ?? images.filter((image) => image.status === "failed").length,
    });

    res.status(201).json({
      success: true,
      message: "Bulk image record saved successfully",
      data: bulkImage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save bulk image record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const GetBulkImages = async (
  req: Request,
  res: Response
) => {
  try {
    const batches = await BulkImage.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: batches,
    });
  } catch (error) {
    console.error("GetBulkImages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bulk images",
    });
  }
};



export const DownloadBulkImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const image = await BulkImage.findById(req.params.id);

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found",
      });
      return;
    }

    const processedImage = image.images.find(
      (entry) => entry.processedImageUrl || entry.convertedFileName
    );

    if (!processedImage) {
      res.status(404).json({
        success: false,
        message: "Processed image file not found",
      });
      return;
    }

    const filePath = path.resolve(
      process.cwd(),
      processedImage.processedImageUrl || processedImage.convertedFileName || ""
    );

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: "Image file not found",
      });
      return;
    }

    res.download(
      filePath,
      processedImage.processedFileName || processedImage.convertedFileName || "image"
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Download failed",
    });
  }
};

// Download all images as ZIP
export const DownloadAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.status(501).json({
      success: false,
      message: "Bulk ZIP download is not configured",
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Download all failed",
      });
    }
  }
};

export const UpdateBulkImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const updatedImage = await BulkImage.findByIdAndUpdate(
      id,
      {
        images: req.body.images,
        totalImages: req.body.totalImages,
        status: req.body.status,
        successCount: req.body.successCount,
        failedCount: req.body.failedCount,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedImage) {
      res.status(404).json({
        success: false,
        message: "Bulk image record not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Bulk image updated successfully",
      data: updatedImage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update bulk image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const DeleteBulkImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const image = await BulkImage.findById(id);

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Bulk image not found",
      });
      return;
    }

    // Delete processed files, if this batch stores any server-side paths.
    const processedPaths = image.images
      .map((entry) => entry.processedImageUrl || entry.convertedFileName)
      .filter((filePath): filePath is string => Boolean(filePath));

    for (const processedPath of processedPaths) {
      const filePath = path.resolve(process.cwd(), processedPath);
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        const fileError = error as NodeJS.ErrnoException;
        if (fileError.code !== "ENOENT") throw error;
      }
    }

    // Delete MongoDB record
    await BulkImage.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Bulk image deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete bulk image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
