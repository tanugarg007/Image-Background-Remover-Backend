import mongoose, { Schema, Types } from "mongoose";

export type FeedbackCategory = "suggestion" | "bug" | "other";

export interface IUserFeedback {
  userId?: Types.ObjectId;
  name: string;
  email: string;
  category: FeedbackCategory;
  message: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const feedbackSchema = new Schema<IUserFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Login" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    category: {
      type: String,
      enum: ["suggestion", "bug", "other"],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
  },
  { timestamps: true }
);

const Feedback =
  (mongoose.models.Feedback as mongoose.Model<IUserFeedback> | undefined) ??
  mongoose.model<IUserFeedback>("Feedback", feedbackSchema);

export default Feedback;
