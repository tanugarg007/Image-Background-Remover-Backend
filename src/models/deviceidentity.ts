import mongoose, { Schema, Types } from "mongoose";

export interface IDeviceIdentity extends mongoose.Document {
  deviceId: string;
  quotaId: Types.ObjectId;
}

const schema = new Schema<IDeviceIdentity>(
  {
    deviceId: { type: String, required: true, unique: true, lowercase: true, trim: true },
    quotaId: { type: Schema.Types.ObjectId, ref: "DeviceQuota", required: true, index: true },
  },
  { timestamps: true }
);

const DeviceIdentity = (mongoose.models.DeviceIdentity as mongoose.Model<IDeviceIdentity> | undefined)
  ?? mongoose.model<IDeviceIdentity>("DeviceIdentity", schema);

export default DeviceIdentity;
