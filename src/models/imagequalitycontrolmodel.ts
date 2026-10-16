import mongoose, { Document, Schema } from "mongoose";

export interface IImagequalitycontrol extends Document {
  imageName: string;
  originalFormat: string;
  outputFormat: "WEBP" | "JPG" | "PNG";
  quality: number;
  width: number;
  height: number;
  maxWidth: number;
  originalSize: number;
  compressedSize: number;
  reducedSize: number;
}

const ImageQualityControl = new Schema<IImagequalitycontrol>(
  {
    imageName: { type: String, required: true, trim: true },
    originalFormat: { type: String, required: true, trim: true },
    outputFormat: { type: String, enum: ["WEBP", "JPG", "PNG"], required: true },
    quality: { type: Number, required: true, min: 10, max: 100 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    maxWidth: { type: Number, min: 0, default: 0 },
    originalSize: { type: Number, required: true, min: 0 },
    compressedSize: { type: Number, required: true, min: 0 },
    reducedSize: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ImageControl = mongoose.model<IImagequalitycontrol>(
  "ImageControl",
  ImageQualityControl
);
