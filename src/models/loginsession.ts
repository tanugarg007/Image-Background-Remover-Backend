import mongoose from "mongoose";

const loginSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AuthUser",
    required: true,
    index: true,
  },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

const LoginSessionModel = mongoose.model("LoginSession", loginSessionSchema);
export default LoginSessionModel;
