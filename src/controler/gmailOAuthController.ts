
import { Request, Response } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import LoginModel from "../models/loginmodel";
import { isFixedSuperadminAccount } from "../config/auth";

const SESSION_COOKIE = "citc_session";
const STATE_COOKIE = "gmail_oauth_state";

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are missing.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const readCookie = (req: Request, name: string): string | undefined => {
  const part = req.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  if (!part) return undefined;

  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return undefined;
  }
};

const cookieOptions = process.env.NODE_ENV === "production"
  ? "; HttpOnly; Secure; SameSite=Lax; Path=/"
  : "; HttpOnly; SameSite=Lax; Path=/";

const requireSuperadmin = async (req: Request): Promise<boolean> => {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return false;

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const user = await LoginModel.findOne({
    sessions: {
      $elemMatch: {
        tokenHash,
        expiresAt: { $gt: new Date() },
      },
    },
  }).select("email role status");

  return Boolean(
    user &&
    user.status !== "disabled" &&
    isFixedSuperadminAccount(user.email, user.role || "user")
  );
};

// Start Google OAuth. Only the Superadmin can connect the sender Gmail account.
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
      scope: ["https://www.googleapis.com/auth/gmail.send"],
      state,
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("[Gmail OAuth] Connect failed:", error);
    res.status(500).send("Could not start Google authorization.");
  }
};

// Google redirects here after the user approves access.
export const gmailOAuthCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const returnedState =
      typeof req.query.state === "string" ? req.query.state : "";
    const savedState = readCookie(req, STATE_COOKIE);
    const code = typeof req.query.code === "string" ? req.query.code : "";

    res.setHeader(
      "Set-Cookie",
     `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`
    );

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
      res.status(400).send("Google authorization could not be verified. Please try again.");
      return;
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.status(400).send(
        "Google did not return a refresh token. Remove this app's access from your Google Account and connect again."
      );
      return;
    }

    // if (process.env.NODE_ENV !== "production") {
    //   console.log("\n========== GMAIL REFRESH TOKEN ==========");
    //   console.log(tokens.refresh_token);
    //   console.log("Copy this token into GOOGLE_REFRESH_TOKEN in your local .env file.");
    //   console.log("Do not share it or commit it to GitHub.");
    //   console.log("=========================================\n");
    // } else {
    //   console.log("[Gmail OAuth] Authorization completed. Refresh token was not logged.");
    // }

res.setHeader("Cache-Control", "no-store");
res.type("text/plain").status(200).send(
  `Google authorization successful!

GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}

Copy this token into your Render environment variable.
Do not share this token or commit it to GitHub.`
);
return;


    res.status(200).send(
      "Google authorization successful. Check your local backend terminal for the refresh token."
    );
  } catch (error) {
    console.error("[Gmail OAuth] Callback failed:", error);
    res.status(500).send("Google authorization failed. Check the backend terminal.");
  }
};
