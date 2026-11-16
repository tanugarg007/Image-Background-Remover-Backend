import { Request, Response } from "express";
import { Types } from "mongoose";
import Feedback, { type FeedbackCategory } from "../models/feedbackmodel";
import { getSessionUser } from "../midleware/sessionuser";

const feedbackCategories: readonly string[] = [
  "suggestion",
  "bug",
  "other",
];

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && feedbackCategories.includes(value);
}

export const submitFeedback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, email, category, message } = req.body ?? {};
  const submittedName = typeof name === "string" ? name.trim() : "";
  const submittedEmail = typeof email === "string" ? email.trim() : "";
  const submittedMessage = typeof message === "string" ? message.trim() : "";

  if (
    (name !== undefined && typeof name !== "string") ||
    (email !== undefined && typeof email !== "string") ||
    submittedName.length > 80 ||
    submittedEmail.length > 254 ||
    (submittedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) ||
    !isFeedbackCategory(category) ||
    !submittedMessage ||
    submittedMessage.length > 3000
  ) {
    res.status(400).json({ success: false, message: "Please provide valid feedback details." });
    return;
  }

  try {
    const user = await getSessionUser(req);
    const feedback = await Feedback.create({
      ...(user ? { userId: new Types.ObjectId(user.id) } : {}),
      ...(user?.name || submittedName ? { name: user?.name || submittedName } : {}),
      ...(user?.email || submittedEmail
        ? { email: user?.email || submittedEmail.toLowerCase() }
        : {}),
      category,
      message: submittedMessage,
    });

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback.",
      data: { id: feedback._id, createdAt: feedback.createdAt },
    });
  } catch (error) {
    console.error("[Feedback] Could not save feedback:", error);
    res.status(500).json({ success: false, message: "Could not submit feedback. Please try again." });
  }
};

export const getAdminFeedback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Superadmin access is required." });
      return;
    }

    const feedback = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    console.error("[Feedback] Could not load feedback:", error);
    res.status(500).json({ success: false, message: "Could not load feedback." });
  }
};
