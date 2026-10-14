import mongoose, { Document, Schema } from "mongoose";

export interface IBackgroundChanger extends Document {
  originalFileName: string;
  outputFileName: string;
  imagePath: string;
  selectedColor: string;
}

const backgroundChangerSchema = new Schema<IBackgroundChanger>(
  {
    originalFileName: { type: String, required: true, trim: true },
    outputFileName: { type: String, required: true, trim: true },
    imagePath: { type: String, required: true, trim: true },
    selectedColor: {
      type: String,
      required: true,
      match: /^#[0-9a-fA-F]{6}$/,
    },
  },
  { timestamps: true }
);

export const BackgroundChanger = mongoose.model<IBackgroundChanger>(
  "BackgroundChanger",
  backgroundChangerSchema
);
