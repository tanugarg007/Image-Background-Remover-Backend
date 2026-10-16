import mongoose, { Document, Schema } from "mongoose";

export type BulkImageStatus = "pending" | "completed" | "failed";

export interface IBulkImageItem {
  originalFileName: string;
  originalFormat: string;
  originalSize: number;
  originalImageUrl?: string;
  convertedFileName?: string;
  convertedFormat?: string;
  convertedSize?: number;
  processedImageUrl?: string;
  processedFileName?: string;
  width?: number;
  height?: number;
  quality?: number;
  maxWidth?: number;
  status: BulkImageStatus;
  errorMessage?: string;
}

export interface IBulkImage extends Document {
  images: IBulkImageItem[];
  totalImages: number;
  status: BulkImageStatus;
  successCount: number;
  failedCount: number;
}

const bulkImageItemSchema = new Schema<IBulkImageItem>(
  {
    originalFileName: { type: String, required: true, trim: true },
    originalFormat: { type: String, required: true, trim: true },
    originalSize: { type: Number, required: true, min: 1 },
    originalImageUrl: { type: String, trim: true },
    convertedFileName: { type: String, trim: true },
    convertedFormat: { type: String, trim: true },
    convertedSize: { type: Number, min: 0 },
    processedImageUrl: { type: String, trim: true },
    processedFileName: { type: String, trim: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    quality: { type: Number, min: 10, max: 100 },
    maxWidth: { type: Number, min: 1 },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      required: true,
    },
    errorMessage: { type: String, trim: true },
  },
  { _id: false }
);

const bulkImageSchema = new Schema<IBulkImage>(
  {
    images: {
      type: [bulkImageItemSchema],
      required: true,
      validate: {
        validator: (images: IBulkImageItem[]) => images.length > 0,
        message: "At least one image is required.",
      },
    },
    totalImages: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" },
    successCount: { type: Number, min: 0, default: 0 },
    failedCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

export const BulkImage = mongoose.model<IBulkImage>("BulkImage", bulkImageSchema);
