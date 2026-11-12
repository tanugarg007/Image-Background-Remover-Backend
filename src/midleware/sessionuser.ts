import { createHash } from "node:crypto";
import type { Request } from "express";
import LoginModel from "../models/loginmodel";
import { isValidSuperadminIdentity } from "../config/auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const getSessionUser = async (req: Request): Promise<SessionUser | null> => {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("citc_session="));
  if (!cookie) return null;

  let token: string;
  try {
    token = decodeURIComponent(cookie.slice("citc_session=".length));
  } catch {
    return null;
  }
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await LoginModel.findOne({
    sessions: {
      $elemMatch: {
        tokenHash,
        expiresAt: { $gt: new Date() },
      },
    },
  }).select("email name role status");

  if (
    !user ||
    user.status === "disabled" ||
    !isValidSuperadminIdentity(user.email, user.role || "user")
  ) return null;
  return { id: String(user._id), email: user.email, name: user.name || user.email, role: user.role || "user" };
};
