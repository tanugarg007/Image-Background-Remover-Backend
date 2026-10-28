import mongoose from "mongoose";

const authUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const AuthUserModel = mongoose.model("AuthUser", authUserSchema);
export default AuthUserModel;
