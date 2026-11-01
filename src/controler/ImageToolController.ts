import { Request, Response } from "express";
import ImageTool from "../models/ImageTool";

const builtInImageTools = [
  { title: "Background Remover", description: "Remove an image background and download a transparent result.", icon: "ImageIcon", route: "#background-removal" },
  { title: "Background Changer", description: "Replace or customize the background of an image.", icon: "Palette", route: "#background-changer" },
  { title: "Background Blur", description: "Keep your subject crisp and blur the background for a portrait-style finish.", icon: "Aperture", route: "#background-blur" },
  { title: "Image Compressor", description: "Reduce image file size while preserving useful quality.", icon: "Minimize2", route: "#image-compressor" },
  { title: "Image Converter", description: "Convert images between supported file formats.", icon: "FileImage", route: "#image-converter" },
  { title: "Image Cropper", description: "Crop and download an image to the desired dimensions.", icon: "Crop", route: "#image-cropper" },
  { title: "Bulk Image Processing", description: "Process multiple images in one workflow.", icon: "Layers", route: "#bulk-processing" },
  { title: "Download Options", description: "View and manage available image download options.", icon: "Archive", route: "#download-options" },
  { title: "Image Analyzer", description: "Analyze an image and review its detected details.", icon: "ScanSearch", route: "#image-analyzer" },
  { title: "Image Quality Controls", description: "Adjust image quality settings and inspect the result.", icon: "SlidersHorizontal", route: "#quality-controls" },
].map((tool, sortOrder) => ({ ...tool, sortOrder, status: "active", isBuiltIn: true, isDeleted: false }));

// GET all image tools
export const getImageTools = async (req: Request, res: Response) => {
  try {
  await Promise.all(builtInImageTools.map(({ sortOrder, ...tool }) =>
      ImageTool.updateOne(
        { route: tool.route },
        { $setOnInsert: tool, $set: { sortOrder } },
        { upsert: true }
      )
    ));

    const tools = await ImageTool.find().sort({ sortOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: tools,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch image tools",
    });
  }
};

// POST create image tool
export const createImageTool = async (req: Request, res: Response) => {
  try {
    const tool = await ImageTool.findOneAndUpdate(
      { route: req.body.route },
      {
        $setOnInsert: req.body,
        $set: { isDeleted: false },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      message: "Image tool created successfully",
      data: tool,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create image tool",
    });
  }
};

// PATCH update image tool
export const updateImageTool = async (req: Request, res: Response) => {
  try {
    const tool = await ImageTool.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Image tool not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Image tool updated successfully",
      data: tool,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update image tool",
    });
  }
};

// PATCH update tool status
export const updateImageToolStatus = async (req: Request, res: Response) => {
  try {
    const tool = await ImageTool.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Image tool not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tool status updated successfully",
      data: tool,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update tool status",
    });
  }
};

// DELETE image tool
export const deleteImageTool = async (req: Request, res: Response) => {
  try {
    const existingTool = await ImageTool.findById(req.params.id);

    if (!existingTool) {
      return res.status(404).json({
        success: false,
        message: "Image tool not found",
      });
    }

    if (existingTool.isBuiltIn) {
      existingTool.isDeleted = true;
      await existingTool.save();
    } else {
      await existingTool.deleteOne();
    }

    res.status(200).json({
      success: true,
      message: "Image tool deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete image tool",
    });
  }
};
