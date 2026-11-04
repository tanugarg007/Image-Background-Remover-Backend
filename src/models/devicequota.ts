import mongoose, { Schema } from "mongoose";

export interface IDeviceQuota extends mongoose.Document {
  downloadsUsed: number;
  pendingReservations: Array<{
    reservationId: string;
    count: number;
    expiresAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IDeviceQuota>(
  {
    downloadsUsed: { type: Number, required: true, default: 0, min: 0 },
    pendingReservations: {
      type: [{
        reservationId: { type: String, required: true },
        count: { type: Number, required: true, min: 1 },
        expiresAt: { type: Date, required: true },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

const DeviceQuota = (mongoose.models.DeviceQuota as mongoose.Model<IDeviceQuota> | undefined)
  ?? mongoose.model<IDeviceQuota>("DeviceQuota", schema);

export default DeviceQuota;
