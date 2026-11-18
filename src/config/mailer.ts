
import { randomBytes } from "crypto";
import type { FeedbackStatus } from "../models/feedbackmodel";
import { getGmailClient } from "./gmailOAuth";

interface FeedbackReplyEmail {
  to: string;
  name: string;
  feedbackMessage: string;
  reply: string;
  status?: FeedbackStatus;
}

const statusLabels: Record<FeedbackStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  resolved: "Resolved",
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);

const encodeMimeBody = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") || "";

export const sendFeedbackReplyEmail = async ({
  to,
  name,
  feedbackMessage,
  reply,
  status = "pending",
}: FeedbackReplyEmail): Promise<void> => {
  const from = process.env.GOOGLE_EMAIL?.trim();

  if (!from || !to) {
    throw new Error(
      "GOOGLE_EMAIL or recipient email is missing."
    );
  }

  const safeName = escapeHtml(name);
  const safeReply = escapeHtml(reply).replace(/\r?\n/g, "<br>");
  const safeFeedback = escapeHtml(feedbackMessage).replace(/\r?\n/g, "<br>");
  const statusLabel = statusLabels[status];

  const text = [
    `Hi ${name},`,
    "",
    "Our team has replied to the feedback you shared with Pixelcraft.",
    `Current status: ${statusLabel}`,
    "",
    "Your feedback:",
    feedbackMessage,
    "",
    "Our reply:",
    reply,
    "",
    "You can also view this update in the My Feedback section of your dashboard.",
    "",
    "Pixelcraft Support",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:36px 16px;background:#f5f6fb;font-family:Arial,sans-serif;color:#293146">
      <div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #e8e9f1;border-radius:20px;background:#ffffff">
        <div style="margin-bottom:24px;color:#6b55d3;font-size:12px;font-weight:700;letter-spacing:1.5px">PIXELCRAFT SUPPORT</div>

        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">We've replied to your feedback</h1>

        <p style="margin:0 0 20px;color:#727b8e;font-size:14px;line-height:1.7">
          Hi ${safeName}, our team has responded to the message you shared with us.
        </p>

        <div style="margin-bottom:16px;padding:10px 13px;border:1px solid #e7e2f8;border-radius:10px;background:#f8f6ff;color:#6553c7;font-size:12px">
          Current status: <strong>${statusLabel}</strong>
        </div>

        <div style="margin-bottom:14px;padding:15px;border:1px solid #eceef4;border-radius:12px;background:#fafbfe">
          <div style="margin-bottom:8px;color:#9299a9;font-size:10px;font-weight:700;letter-spacing:1px">YOUR FEEDBACK</div>
          <div style="color:#465168;font-size:13px;line-height:1.7">${safeFeedback}</div>
        </div>

        <div style="padding:16px;border:1px solid #dfece6;border-radius:12px;background:#f4fbf6">
          <div style="margin-bottom:8px;color:#438265;font-size:10px;font-weight:700;letter-spacing:1px">OUR REPLY</div>
          <div style="color:#475b51;font-size:13px;line-height:1.7">${safeReply}</div>
        </div>

        <p style="margin:22px 0 0;color:#818a9f;font-size:12px;line-height:1.7">
          You can also view this update in the <strong>My Feedback</strong> section of your dashboard.
        </p>
      </div>
    </div>
  `;

  const boundary = `boundary_${randomBytes(16).toString("hex")}`;

  const mimeMessage = [
    `From: ${from}`,
    `To: ${to}`,
    "Subject: We've replied to your feedback",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(html),
    `--${boundary}--`,
  ].join("\r\n");

  const raw = Buffer.from(mimeMessage, "utf8").toString("base64url");

  const gmail = getGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
};
