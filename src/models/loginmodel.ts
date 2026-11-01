import mongoose from "mongoose";

const sessionEntrySchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const loginSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    role: {
      type: String,
      default: "user",
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    sessions: {
      type: [sessionEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const LoginModel = mongoose.model("Login", loginSchema);

export default LoginModel;
