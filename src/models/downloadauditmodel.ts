import mongoose, { Schema, Types } from "mongoose";

export interface IDownloadAudit extends mongoose.Document {
  userId?: Types.ObjectId;
  userEmail: string;
  userName?: string;
  userRole: string;
  tool: string;
  fileName: string;
  fileSize?: number;
  downloadedAt: Date;
}

const downloadAuditSchema = new Schema<IDownloadAudit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Login" },
    userEmail: { type: String, required: true, trim: true },
    userName: { type: String, trim: true },
    userRole: { type: String, required: true, trim: true },
    tool: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number, min: 0 },
    downloadedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const DownloadAudit =
  (mongoose.models.DownloadAudit as mongoose.Model<IDownloadAudit> | undefined) ??
  mongoose.model<IDownloadAudit>("DownloadAudit", downloadAuditSchema);

export default DownloadAudit;
