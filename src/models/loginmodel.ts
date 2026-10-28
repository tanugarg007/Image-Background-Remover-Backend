import mongoose from "mongoose";

const loginSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const loginSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
    sessions: { type: [loginSessionSchema], default: [] },
  },
  { timestamps: true }
);

const LoginModel = mongoose.model("Login", loginSchema);
export default LoginModel;
