
import mongoose, { Schema, Document } from "mongoose";

export interface IImageCompressor extends Document {
  url: string;
  compressedUrl: string;
  quality: number;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  reducedSize: number;
}

const ImageCompressorSchema: Schema<IImageCompressor> =
  new Schema(
    {
      url: {
        type: String,
        required: true,
      },
      compressedUrl: {
        type: String,
        required: true,
      },
      quality: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
      },
      width: {
        type: Number,
        required: true,
      },
      height: {
        type: Number,
        required: true,
      },
      originalSize: {
        type: Number,
        required: true,
      },
      compressedSize: {
        type: Number,
        required: true,
      },
      reducedSize: {
        type: Number,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

const ImageCompressor =
  mongoose.model<IImageCompressor>(
    "ImageCompressor",
    ImageCompressorSchema
  );

export default ImageCompressor;
