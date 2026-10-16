
import mongoose, { Schema, Document } from "mongoose";

export interface IImageAnalyzer extends Document {
  fileName: string;
  url: string;
  contentHash: string;
  fileSize: number;
  format: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: string;
  colorMode?: string;
  hasTransparency: boolean;
  metadata?: Record<string, unknown>;
  analyzedAt: Date;
}

const ImageAnalyzerSchema = new Schema<IImageAnalyzer>(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    url: {
      type: String,
      default: "",
    },

    contentHash: {
      type: String,
    },

    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },

    format: {
      type: String,
      required: true,
      uppercase: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    width: {
      type: Number,
      required: true,
      min: 1,
    },

    height: {
      type: Number,
      required: true,
      min: 1,
    },

    aspectRatio: {
      type: String,
      required: true,
    },

    colorMode: {
      type: String,
      default: "unknown",
    },

    hasTransparency: {
      type: Boolean,
      default: false,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

ImageAnalyzerSchema.index(
  { contentHash: 1 },
  {
    unique: true,
    partialFilterExpression: { contentHash: { $type: "string" } },
  }
);

export const ImageAnalyzer = mongoose.model<IImageAnalyzer>(
  "ImageAnalyzer",
  ImageAnalyzerSchema
);
