import mongoose from "mongoose";

const imageToolSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    route: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isBuiltIn: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 1000,
    },
  },
  { timestamps: true }
);

const ImageTool = mongoose.model("ImageTool", imageToolSchema);

export default ImageTool;
