import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";
import { Types } from "mongoose";
import AuthUserModel from "../models/authuser";
import LoginSessionModel from "../models/loginsession";

const COOKIE_NAME = "citc_session";
const REMEMBER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const TEMP_SESSION_MS = 12 * 60 * 60 * 1000;
const PASSWORD_BYTES = 64;
const MAX_LOGIN_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const DUMMY_SALT = "4d1e09a00f14a7ba36b9d480b182f7c1";
const DUMMY_HASH = Buffer.alloc(PASSWORD_BYTES);

const derivePasswordHash = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_BYTES, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const readSessionToken = (req: Request): string | undefined => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : undefined;
};

const setSessionCookie = (res: Response, token: string, remember: boolean): void => {
  const maxAge = remember ? `; Max-Age=${Math.floor(REMEMBER_SESSION_MS / 1000)}` : "";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${maxAge}${secure}`
  );
};

const clearSessionCookie = (res: Response): void => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
  );
};

const validCredentials = (email: unknown, password: unknown):
  email is string =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128;

const createSession = async (
  userId: Types.ObjectId,
  res: Response,
  remember: boolean
): Promise<void> => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_SESSION_MS : TEMP_SESSION_MS));
  await LoginSessionModel.create({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  setSessionCookie(res, token, remember);
};

const userResponse = (user: { _id: unknown; email: string }) => ({
  id: String(user._id),
  email: user.email,
});

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, remember } = req.body as {
    email?: unknown;
    password?: unknown;
    remember?: unknown;
  };

  if (!validCredentials(email, password)) {
    res.status(400).json({
      success: false,
      message: "Enter a valid email and a password between 8 and 128 characters.",
    });
    return;
  }

  try {
    const validEmail = email as string;
    const validPassword = password as string;
    const normalizedEmail = validEmail.trim().toLowerCase();
    const existingUser = await AuthUserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }

    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = (await derivePasswordHash(validPassword, passwordSalt)).toString("hex");
    const user = await AuthUserModel.create({ email: normalizedEmail, passwordSalt, passwordHash });
    await createSession(user._id, res, remember === true);

    res.status(201).json({ success: true, user: userResponse(user) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }
    console.error("[Auth] Registration failed:", error);
    res.status(500).json({ success: false, message: "Could not create the account right now." });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password, remember } = req.body as {
    email?: unknown;
    password?: unknown;
    remember?: unknown;
  };

  if (!validCredentials(email, password)) {
    res.status(400).json({ success: false, message: "Enter a valid email and password." });
    return;
  }

  const clientKey = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  for (const [key, value] of loginFailures) {
    if (value.resetAt <= now) loginFailures.delete(key);
  }
  const attempts = loginFailures.get(clientKey);
  if (attempts && attempts.resetAt > now && attempts.count >= MAX_LOGIN_FAILURES) {
    res.setHeader("Retry-After", String(Math.ceil((attempts.resetAt - now) / 1000)));
    res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    return;
  }

  try {
    const validEmail = email as string;
    const validPassword = password as string;
    const normalizedEmail = validEmail.trim().toLowerCase();
    const user = await AuthUserModel.findOne({ email: normalizedEmail });
    const suppliedHash = await derivePasswordHash(
      validPassword,
      user?.passwordSalt || DUMMY_SALT
    );
    const storedHash = user ? Buffer.from(user.passwordHash, "hex") : DUMMY_HASH;
    const passwordMatches =
      suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash);
    if (!user || !passwordMatches) {
      const current = loginFailures.get(clientKey);
      if (!current || current.resetAt <= Date.now()) {
        loginFailures.set(clientKey, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
      } else {
        current.count += 1;
      }
      res.status(401).json({ success: false, message: "Email or password is incorrect." });
      return;
    }

    loginFailures.delete(clientKey);
    await createSession(user._id, res, remember === true);
    res.status(200).json({ success: true, user: userResponse(user) });
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    res.status(500).json({ success: false, message: "Could not sign in right now." });
  }
};

export const currentUser = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const session = await LoginSessionModel.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).populate("userId", "email");

    if (!session || !session.userId || typeof session.userId !== "object" || !("email" in session.userId)) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }

    const user = session.userId as unknown as { _id: unknown; email: string };
    res.status(200).json({ success: true, user: userResponse(user) });
  } catch (error) {
    console.error("[Auth] Session lookup failed:", error);
    res.status(500).json({ success: false, message: "Could not check your session right now." });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  clearSessionCookie(res);

  if (token) {
    try {
      await LoginSessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
      res.status(500).json({ success: false, message: "Could not sign out right now." });
      return;
    }
  }

  res.status(200).json({ success: true, message: "Signed out." });
};
