import mongoose, { Schema, Document } from "mongoose";

export interface IPermission extends Document {
  name: string;
  description: string;
  module: string;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Permission = mongoose.model<IPermission>(
  "Permission",
  permissionSchema
);

export default Permission;