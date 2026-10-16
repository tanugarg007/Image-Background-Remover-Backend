// models/downloadzipmodel.ts

import mongoose, { Schema, Document, Model } from "mongoose";

interface IDownloadedFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface IDownloadOptions extends Document {
  zipName: string;
  files: IDownloadedFile[];
  totalFiles: number;
  totalSize: number;
  downloadedAt: Date;
}

const DownloadZipSchema = new Schema<IDownloadOptions>(
  {
    zipName: {
      type: String,
      required: true,
    },
    files: [
      {
        fileName: { type: String, required: true },
        mimeType: { type: String, required: true },
        fileSize: { type: Number, required: true },
      },
    ],
    totalFiles: {
      type: Number,
      required: true,
    },
    totalSize: {
      type: Number,
      required: true,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const DownloadOptions: Model<IDownloadOptions> =
  (mongoose.models.DownloadOptions as Model<IDownloadOptions> | undefined) ??
  mongoose.model<IDownloadOptions>("DownloadOptions", DownloadZipSchema);
