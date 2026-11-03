import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";
import { Types } from "mongoose";
import LoginModel from "../models/loginmodel";
import RolePermissionConfig, { DEFAULT_ROLE_PERMISSIONS } from "../models/rolepermissionmodel";

const COOKIE_NAME = "citc_session";
const REMEMBER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const TEMP_SESSION_MS = 12 * 60 * 60 * 1000;
const PASSWORD_BYTES = 64;
const MAX_LOGIN_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const DUMMY_SALT = "4d1e09a00f14a7ba36b9d480b182f7c1";
const DUMMY_HASH = Buffer.alloc(PASSWORD_BYTES);
const ALLOWED_ROLES = ["user", "admin", "superadmin"] as const;
const ALLOWED_STATUSES = ["active", "disabled"] as const;

const getAssignableRoles = async (): Promise<string[]> => {
  const config = await RolePermissionConfig.findOne({ key: "main" }).lean();
  const configured = config?.permissions && typeof config.permissions === "object"
    ? Object.keys(config.permissions as Record<string, unknown>)
    : [];
  return [...new Set([...ALLOWED_ROLES, ...Object.keys(DEFAULT_ROLE_PERMISSIONS), ...configured])];
};

const isValidEmail = (email: unknown): email is string =>
  typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidName = (name: unknown): name is string =>
  typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 80;

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
  isValidEmail(email) &&
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
  const user = await LoginModel.findById(userId);
  if (!user) throw new Error("Login account disappeared while creating a session.");

  const now = new Date();
  for (let index = user.sessions.length - 1; index >= 0; index -= 1) {
    const session = user.sessions[index];
    if (session && session.expiresAt <= now) user.sessions.splice(index, 1);
  }
  user.sessions.push({ tokenHash: hashSessionToken(token), expiresAt });
  if (user.sessions.length > 10) user.sessions.splice(0, user.sessions.length - 10);
  await user.save();
  setSessionCookie(res, token, remember);
};

const userResponse = (user: { _id: unknown; email: string; name?: string | null; role?: string }) => ({
  id: String(user._id),
  email: user.email,
  name: user.name || user.email,
  role: user.role || "user",
});

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, remember } = req.body as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    remember?: unknown;
  };

  if (!isValidName(name) || !validCredentials(email, password)) {
    res.status(400).json({
      success: false,
      message: "Enter your name, a valid email, and a password between 8 and 128 characters.",
    });
    return;
  }

  try {
    const validEmail = email as string;
    const validPassword = password as string;
    const normalizedEmail = validEmail.trim().toLowerCase();
    const existingUser = await LoginModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }

    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = (await derivePasswordHash(validPassword, passwordSalt)).toString("hex");
    const user = await LoginModel.create({ name: name.trim(), email: normalizedEmail, passwordSalt, passwordHash });
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
    const user = await LoginModel.findOne({ email: normalizedEmail });
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

    if (user.status === "disabled") {
      res.status(403).json({ success: false, message: "This account is disabled. Contact an administrator." });
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
    const user = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("name email role status");

    if (!user) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }

    if (user.status === "disabled") {
      res.status(401).json({ success: false, message: "This account is disabled. Contact an administrator." });
      return;
    }

    res.status(200).json({ success: true, user: userResponse(user) });
  } catch (error) {
    console.error("[Auth] Session lookup failed:", error);
    res.status(500).json({ success: false, message: "Could not check your session right now." });
  }
};

// Public, non-erroring session probe for UI features that need guest/member state.
export const sessionStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const token = readSessionToken(req);

  if (!token) {
    res.status(200).json({
      success: true,
      authenticated: false,
    });
    return;
  }

  try {
    const user = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("status");

    res.status(200).json({
      success: true,
      authenticated: Boolean(user && user.status !== "disabled"),
    });
  } catch (error) {
    console.error("[Auth] Session status lookup failed:", error);

    res.status(500).json({
      success: false,
      authenticated: false,
      message: "Could not check session status.",
    });
  }
};
export const adminUsers = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const currentUser = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("role status");

    if (!currentUser) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }
    if (currentUser.status === "disabled") {
      res.status(401).json({ success: false, message: "This account is disabled." });
      return;
    }

    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }

    const [users, total, admins, userRoleCount, adminRoleCount, superadminRoleCount] = await Promise.all([
      LoginModel.find({}).select("name email role status createdAt").sort({ createdAt: -1 }).lean(),
      LoginModel.countDocuments(),
      LoginModel.countDocuments({ role: { $in: ["admin", "superadmin"] } }),
      LoginModel.countDocuments({ role: "user" }),
      LoginModel.countDocuments({ role: "admin" }),
      LoginModel.countDocuments({ role: "superadmin" }),
    ]);

    res.status(200).json({
      success: true,
      total,
      admins,
      roleCounts: { user: userRoleCount, admin: adminRoleCount, superadmin: superadminRoleCount },
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name || user.email,
        email: user.email,
        role: user.role || "user",
        status: user.status || "active",
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Auth] Admin user list failed:", error);
    res.status(500).json({ success: false, message: "Could not load accounts right now." });
  }
};

export const createAdminAccount = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const currentUser = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("role status");

    if (!currentUser) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }
    if (currentUser.status === "disabled") {
      res.status(401).json({ success: false, message: "This account is disabled." });
      return;
    }

    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }

    const { name, email, password, role, status } = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      status?: unknown;
    };
    if (!isValidEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
      res.status(400).json({ success: false, message: "Enter a valid email and a password between 8 and 128 characters." });
      return;
    }

    const accountRole = role ?? "user";
    const accountStatus = status ?? "active";
    const assignableRoles = await getAssignableRoles();
    if (typeof accountRole !== "string" || !assignableRoles.includes(accountRole)) {
      res.status(400).json({ success: false, message: "Choose a role that exists in role settings." });
      return;
    }
    if (typeof accountStatus !== "string" || !ALLOWED_STATUSES.includes(accountStatus as (typeof ALLOWED_STATUSES)[number])) {
      res.status(400).json({ success: false, message: "Choose active or disabled status." });
      return;
    }
    if (currentUser.role === "admin" && accountRole !== "user") {
      res.status(403).json({ success: false, message: "Only a superadmin can assign administrator roles." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (name !== undefined && !isValidName(name)) {
      res.status(400).json({ success: false, message: "Enter a name between 1 and 80 characters." });
      return;
    }
    if (await LoginModel.exists({ email: normalizedEmail })) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }

    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = (await derivePasswordHash(password, passwordSalt)).toString("hex");
    const accountName = isValidName(name) ? name.trim() : (normalizedEmail.split("@")[0] || normalizedEmail);
    const user = await LoginModel.create({
      email: normalizedEmail,
      name: accountName,
      passwordSalt,
      passwordHash,
      role: accountRole,
      status: accountStatus as "active" | "disabled",
    });

    res.status(201).json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }
    console.error("[Auth] Admin account creation failed:", error);
    res.status(500).json({ success: false, message: "Could not create the account right now." });
  }
};

export const updateAdminAccount = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const currentUser = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("role status");

    if (!currentUser) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }
    if (currentUser.status === "disabled") {
      res.status(401).json({ success: false, message: "This account is disabled." });
      return;
    }

    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }

    const userId = req.params.id;
    if (typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid account ID." });
      return;
    }

    const { name, email, role, status } = req.body as { name?: unknown; email?: unknown; role?: unknown; status?: unknown };
    if (name === undefined && email === undefined && role === undefined && status === undefined) {
      res.status(400).json({ success: false, message: "Provide a name, email, role, or status to update." });
      return;
    }
    if (name !== undefined && !isValidName(name)) {
      res.status(400).json({ success: false, message: "Enter a name between 1 and 80 characters." });
      return;
    }
    if (email !== undefined && !isValidEmail(email)) {
      res.status(400).json({ success: false, message: "Enter a valid email address." });
      return;
    }
    if (role !== undefined) {
      const assignableRoles = await getAssignableRoles();
      if (typeof role !== "string" || !assignableRoles.includes(role)) {
        res.status(400).json({ success: false, message: "Choose a role that exists in role settings." });
        return;
      }
    }
    if (status !== undefined && (typeof status !== "string" || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number]))) {
      res.status(400).json({ success: false, message: "Choose active or disabled status." });
      return;
    }

    const account = await LoginModel.findById(userId);
    if (!account) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    if (currentUser.role === "admin" && account.role !== "user") {
      res.status(403).json({ success: false, message: "Admins can only edit standard user accounts." });
      return;
    }
    if (currentUser.role === "admin" && role !== undefined && role !== account.role) {
      res.status(403).json({ success: false, message: "Only a superadmin can change account roles." });
      return;
    }

    if (String(account._id) === String(currentUser._id) && ((currentUser.role === "superadmin" && role !== undefined && role !== "superadmin") || (status !== undefined && status !== "active"))) {
      res.status(400).json({ success: false, message: "You cannot remove your own superadmin access or disable your account." });
      return;
    }

    if (name !== undefined) account.name = (name as string).trim();
    if (email !== undefined) account.email = (email as string).trim().toLowerCase();
    if (role !== undefined) account.role = role as string;
    if (status !== undefined) account.status = status as "active" | "disabled";
    await account.save();

    res.status(200).json({
      success: true,
      user: {
        id: String(account._id),
        name: account.name || account.email,
        email: account.email,
        role: account.role || "user",
        status: account.status || "active",
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }
    console.error("[Auth] Admin account update failed:", error);
    res.status(500).json({ success: false, message: "Could not update the account right now." });
  }
};

export const deleteAdminAccount = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const currentUser = await LoginModel.findOne({
      sessions: {
        $elemMatch: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
    }).select("role status");

    if (!currentUser) {
      res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
      return;
    }
    if (currentUser.status === "disabled") {
      res.status(401).json({ success: false, message: "This account is disabled." });
      return;
    }
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }

    const userId = req.params.id;
    if (typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid account ID." });
      return;
    }
    if (String(currentUser._id) === userId) {
      res.status(400).json({ success: false, message: "You cannot delete your own account." });
      return;
    }

    const account = await LoginModel.findById(userId);
    if (!account) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }
    if (currentUser.role === "admin" && account.role !== "user") {
      res.status(403).json({ success: false, message: "Admins can only delete standard user accounts." });
      return;
    }

    await account.deleteOne();
    res.status(200).json({ success: true, message: "Account deleted." });
  } catch (error) {
    console.error("[Auth] Admin account deletion failed:", error);
    res.status(500).json({ success: false, message: "Could not delete the account right now." });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = readSessionToken(req);
  clearSessionCookie(res);

  if (token) {
    try {
      await LoginModel.updateOne(
        { "sessions.tokenHash": hashSessionToken(token) },
        { $pull: { sessions: { tokenHash: hashSessionToken(token) } } }
      );
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
      res.status(500).json({ success: false, message: "Could not sign out right now." });
      return;
    }
  }

  res.status(200).json({ success: true, message: "Signed out." });
};
