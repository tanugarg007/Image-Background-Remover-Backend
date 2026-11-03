import mongoose, { Document, Schema } from "mongoose";

export interface IBackgroundBlur extends Document {
  originalFileName: string;
  outputFileName: string;
  storedFileName: string;
  blurStrength: number;
  originalSize: number;
  outputSize: number;
  width: number;
  height: number;
  createdAt: Date;
}

const backgroundBlurSchema = new Schema<IBackgroundBlur>(
  {
    originalFileName: { type: String, required: true, trim: true },
    outputFileName: { type: String, required: true, trim: true },
    storedFileName: { type: String, required: true, trim: true },
    blurStrength: { type: Number, required: true, min: 2, max: 32 },
    originalSize: { type: Number, required: true, min: 1 },
    outputSize: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

export const BackgroundBlur = mongoose.model<IBackgroundBlur>(
  "BackgroundBlur",
  backgroundBlurSchema
);
