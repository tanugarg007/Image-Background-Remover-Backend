
import { google } from "googleapis";

export const getGmailClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      "Google OAuth is not configured. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_REFRESH_TOKEN."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
};
