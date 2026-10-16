import mongoose, { Document, Schema } from "mongoose";

export interface IImageCropper extends Document {
  originalFileName: string;
  croppedFileName: string;
  storedFileName: string;
  originalFormat: string;
  croppedFormat: string;
  originalSize: number;
  croppedSize: number;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  aspectRatio: string;
  createdAt: Date;
}

const imageCropperSchema = new Schema<IImageCropper>(
  {
    originalFileName: { type: String, required: true, trim: true },
    croppedFileName: { type: String, required: true, trim: true },
    storedFileName: { type: String, required: true, trim: true },
    originalFormat: { type: String, required: true, trim: true },
    croppedFormat: { type: String, required: true, trim: true },
    originalSize: { type: Number, required: true, min: 1 },
    croppedSize: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    cropX: { type: Number, required: true, min: 0 },
    cropY: { type: Number, required: true, min: 0 },
    cropWidth: { type: Number, required: true, min: 1 },
    cropHeight: { type: Number, required: true, min: 1 },
    aspectRatio: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ImageCropper = mongoose.model<IImageCropper>(
  "ImageCropper",
  imageCropperSchema
);
