
import mongoose, { Schema, Document } from "mongoose";

export interface IImageConverter extends Document {
  originalFileName: string;
  convertedFileName: string;
  storedFileName: string;
  originalFormat: string;
  convertedFormat: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
}

const imageConverterSchema = new Schema<IImageConverter>(
  {
    originalFileName: {
      type: String,
      required: true,
    },
    convertedFileName: {
      type: String,
      required: true,
    },
    storedFileName: {
      type: String,
      required: true,
    },
    originalFormat: {
      type: String,
      required: true,
    },
    convertedFormat: {
      type: String,
      required: true,
    },
    originalSize: {
      type: Number,
      required: true,
    },
    convertedSize: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const ImageConverter = mongoose.model<IImageConverter>(
  "ImageConverter",
  imageConverterSchema
);
