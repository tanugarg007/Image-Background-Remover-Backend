import mongoose from "mongoose";
import dotenv from "dotenv";
import { env } from "node:process";

dotenv.config();

export const connectDB = async (): Promise<void> => {
  const mongoUri = env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is required");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully");
};
