
import { Request, Response } from "express";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { google } from "googleapis";
import LoginModel from "../models/loginmodel";
import {
  isFixedSuperadminAccount,
  isValidSuperadminIdentity,
} from "../config/auth";

const SESSION_COOKIE = "citc_session";
const STATE_COOKIE = "gmail_oauth_state";

// Create Google OAuth client
const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are missing.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
};

// Read cookie from request
const readCookie = (
  req: Request,
  name: string
): string | undefined => {
  const part = req.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  if (!part) return undefined;

  try {
    return decodeURIComponent(
      part.slice(name.length + 1)
    );
  } catch {
    return undefined;
  }
};

// Cookie options
const cookieOptions =
  process.env.NODE_ENV === "production"
    ? "; HttpOnly; Secure; SameSite=Lax; Path=/"
    : "; HttpOnly; SameSite=Lax; Path=/";

// Verify Superadmin session
const requireSuperadmin = async (
  req: Request
): Promise<boolean> => {
    console.log("[GMAIL CHECK] requireSuperadmin started");
  const token = readCookie(req, SESSION_COOKIE);

  console.log("[GMAIL CHECK] Cookie received:", Boolean(token));
  if (!token) return false;

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await LoginModel.findOne({
    sessions: {
      $elemMatch: {
        tokenHash,
        expiresAt: { $gt: new Date() },
      },
    },
  }).select("email role status");

  console.log("[Gmail OAuth Debug]", {
    cookieReceived: Boolean(token),
    sessionFound: Boolean(user),
    email: user?.email,
    role: user?.role,
    status: user?.status,
    isFixedSuperadmin: user
      ? isFixedSuperadminAccount(user.email, user.role)
      : false,
    isValidSuperadmin: user
      ? isValidSuperadminIdentity(user.email, user.role)
      : false,
  });

  return Boolean(
    user &&
    user.status !== "disabled" &&
    isValidSuperadminIdentity(user.email, user.role)
  );
};

// Start Google OAuth
export const connectGmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const allowed = await requireSuperadmin(req);

    if (!allowed) {
      res.status(403).send("Superadmin access is required.");
      return;
    }

    const state = randomBytes(32).toString("hex");

    res.setHeader(
      "Set-Cookie",
      `${STATE_COOKIE}=${state}${cookieOptions}; Max-Age=600`
    );

    const oauth2Client = getOAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
      ],
      state,
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("[Gmail OAuth] Connect failed:", error);
    res.status(500).send(
      "Could not start Google authorization."
    );
  }
};

// Google OAuth callback
export const gmailOAuthCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const returnedState =
      typeof req.query.state === "string"
        ? req.query.state
        : "";

    const savedState = readCookie(req, STATE_COOKIE);

    const code =
      typeof req.query.code === "string"
        ? req.query.code
        : "";

    // Clear OAuth state cookie
    res.setHeader(
      "Set-Cookie",
      `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${
        process.env.NODE_ENV === "production"
          ? "; Secure"
          : ""
      }`
    );

    // Verify OAuth state
    if (
      !savedState ||
      !returnedState ||
      !code ||
      savedState.length !== returnedState.length ||
      !timingSafeEqual(
        Buffer.from(savedState),
        Buffer.from(returnedState)
      )
    ) {
      res.status(400).send(
        "Google authorization could not be verified. Please try again."
      );
      return;
    }

    // Verify Superadmin session again
    const allowed = await requireSuperadmin(req);

    if (!allowed) {
      res.status(403).send(
        "Superadmin access is required."
      );
      return;
    }

    // Exchange authorization code for tokens
    const oauth2Client = getOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    // Check refresh token
    if (!tokens.refresh_token) {
      res.status(400).send(
        "Google did not return a refresh token. Remove this app's access from your Google Account and connect again."
      );
      return;
    }

    // Prevent browser caching
    res.setHeader("Cache-Control", "no-store");

    // Display refresh token once to the authenticated Superadmin
    res.type("text/plain").status(200).send(
      `Google authorization successful!

GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}

Copy this token into your Render environment variable.
Do not share this token or commit it to GitHub.`
    );

    return;

  } catch (error) {
    console.error("[Gmail OAuth] Callback failed:", error);

    res.status(500).send(
      "Google authorization failed. Check the backend logs."
    );
  }
};
