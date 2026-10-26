import mongoose, { Schema, Document } from "mongoose";

export interface IBackgroundChanger extends Document {
  originalFileName: string;
  outputFileName: string;
  imagePath: string;
  selectedColor: string;
  createdAt: Date;
}

const backgroundChangerSchema = new Schema<IBackgroundChanger>(
  {
    originalFileName: { type: String, required: true },
    outputFileName: { type: String, required: true },
    imagePath: { type: String, required: true },
    selectedColor: { type: String, required: true },
  },
  { timestamps: true }
);

export const BackgroundChanger = mongoose.model<IBackgroundChanger>(
  "BackgroundChanger",
  backgroundChangerSchema
);