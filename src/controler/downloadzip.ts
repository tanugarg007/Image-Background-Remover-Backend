import { Request, Response } from "express";
import mongoose from "mongoose";
import JSZip from "jszip";
import { DownloadOptions } from "../models/downloadzipmodel";

export const DownloadZip = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: "Please upload at least one image.",
      });
      return;
    }

    const zip = new JSZip();

    let totalSize = 0;

    const fileDetails = files.map((file) => {
      totalSize += file.size;

      // Add each uploaded file to ZIP
      zip.file(file.originalname, file.buffer);

      return {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
    });

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const zipName = `images-${Date.now()}.zip`;

    // Save download metadata in MongoDB
    await DownloadOptions.create({
      zipName,
      files: fileDetails,
      totalFiles: files.length,
      totalSize,
    });

    // Send ZIP file to frontend
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipName}"`
    );

    res.status(200).send(zipBuffer);
  } catch (error) {
    console.error("Download ZIP error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create ZIP file.",
    });
  }
};

// 1. GET ALL DOWNLOAD HISTORY
export const GetDownloadHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const downloads = await DownloadOptions.find().sort({
      downloadedAt: -1,
    });

    res.status(200).json({
      success: true,
      count: downloads.length,
      data: downloads,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch download history.",
    });
  }
};

// 2. GET DOWNLOAD DETAILS BY ID
export const GetDownloadById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid download ID.",
      });
      return;
    }

    const download = await DownloadOptions.findById(id);

    if (!download) {
      res.status(404).json({
        success: false,
        message: "Download record not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: download,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch download details.",
    });
  }
};

// 3. UPDATE DOWNLOAD RECORD
export const UpdateDownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { zipName } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid download ID.",
      });
      return;
    }

    if (typeof zipName !== "string" || !zipName.trim()) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid ZIP name.",
      });
      return;
    }

    const updatedDownload = await DownloadOptions.findByIdAndUpdate(
      id,
      { $set: { zipName: zipName.trim() } },
      { new: true, runValidators: true }
    );

    if (!updatedDownload) {
      res.status(404).json({
        success: false,
        message: "Download record not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Download record updated successfully.",
      data: updatedDownload,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update download record.",
    });
  }
};

// 4. DELETE DOWNLOAD RECORD
export const DeleteDownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid download ID.",
      });
      return;
    }

    const deletedDownload = await DownloadOptions.findByIdAndDelete(id);

    if (!deletedDownload) {
      res.status(404).json({
        success: false,
        message: "Download record not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Download history record deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete download record.",
    });
  }
};
