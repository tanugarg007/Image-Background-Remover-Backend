import { createHmac, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import DeviceIdentity from "../models/deviceidentity";
import DeviceQuota from "../models/devicequota";
import { getSessionUser } from "../midleware/sessionuser";

const FREE_LIMIT = 3;
const DEVICE_COOKIE = "citc_guest_device";
const DEVICE_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const RESERVATION_TTL_MS = 15 * 60 * 1000;

function readCookie(req: Request, name: string): string | null {
  const value = req.headers.cookie?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

function getOrSetDeviceId(req: Request, res: Response): string {
  const existing = readCookie(req, DEVICE_COOKIE);
  if (existing && DEVICE_ID_PATTERN.test(existing)) return existing.toLowerCase();
  const deviceId = randomUUID();
  const secure = req.secure ? "; Secure" : "";
  res.append("Set-Cookie", `${DEVICE_COOKIE}=${encodeURIComponent(deviceId)}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax${secure}`);
  return deviceId;
}

function getIpHash(req: Request): string | null {
  let address = req.ip || req.socket.remoteAddress || "";
  if (!address) return null;
  if (address.startsWith("::ffff:")) address = address.slice(7);
  const secret = process.env.GUEST_IP_HASH_SECRET || process.env.MONGO_URI;
  if (!secret) return null;
  return createHmac("sha256", secret).update(address).digest("hex");
}

async function getOrCreateQuota(deviceId: string, ipHash: string | null) {
  const identity = await DeviceIdentity.findOne({ deviceId });
  if (identity) {
    const quota = await DeviceQuota.findById(identity.quotaId);
    if (quota) return quota;
    await DeviceIdentity.deleteOne({ _id: identity._id });
  }

  // A browser without a known device cookie can reuse a quota seen from the same
  // public IP. Existing browser cookies keep their quota when the network changes.
  const matchingIpQuota = ipHash ? await DeviceQuota.findOne({ ipHash }) : null;
  if (matchingIpQuota) {
    try {
      await DeviceIdentity.create({ deviceId, quotaId: matchingIpQuota._id });
      return matchingIpQuota;
    } catch {
      const winner = await DeviceIdentity.findOne({ deviceId });
      const quota = winner ? await DeviceQuota.findById(winner.quotaId) : null;
      if (quota) return quota;
      throw new Error("Could not initialize this browser's download quota.");
    }
  }

  const quota = await DeviceQuota.create({ downloadsUsed: 0, ...(ipHash ? { ipHash } : {}) });
  try {
    await DeviceIdentity.create({ deviceId, quotaId: quota._id });
    return quota;
  } catch {
    await DeviceQuota.deleteOne({ _id: quota._id });
    const winner = await DeviceIdentity.findOne({ deviceId });
    const winningQuota = winner ? await DeviceQuota.findById(winner.quotaId) : null;
    if (winningQuota) return winningQuota;
    throw new Error("Could not initialize this browser's download quota.");
  }
}

async function getGuestQuota(req: Request, res: Response) {
  const deviceId = getOrSetDeviceId(req, res);
  return getOrCreateQuota(deviceId, getIpHash(req));
}

function sendQuota(res: Response, used: number, authenticated: boolean) {
  res.status(200).json({
    success: true,
    authenticated,
    limit: FREE_LIMIT,
    used,
    remaining: authenticated ? null : Math.max(0, FREE_LIMIT - used),
  });
}

export async function getDeviceQuota(req: Request, res: Response): Promise<void> {
  try {
    const user = await getSessionUser(req);
    if (user) {
      sendQuota(res, 0, true);
      return;
    }
    const quota = await getGuestQuota(req, res);
    sendQuota(res, quota.downloadsUsed, false);
  } catch (error) {
    console.error("[Device quota] Could not load quota:", error);
    res.status(500).json({ success: false, message: "Could not load the download limit." });
  }
}

export async function consumeDeviceQuota(req: Request, res: Response): Promise<void> {
  const count = req.body?.count === undefined ? 1 : req.body.count;
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    res.status(400).json({ success: false, message: "Provide a valid download count." });
    return;
  }
  try {
    if (await getSessionUser(req)) {
      res.status(200).json({ success: true, allowed: true, authenticated: true, remaining: null });
      return;
    }
    const quota = await getGuestQuota(req, res);
    const now = new Date();
    await DeviceQuota.updateOne(
      { _id: quota._id },
      { $pull: { pendingReservations: { expiresAt: { $lte: now } } } }
    );
    if (count > FREE_LIMIT) {
      res.status(200).json({ success: true, allowed: false, authenticated: false, remaining: 0 });
      return;
    }
    const reservationId = randomUUID();
    const reservation = { reservationId, count, expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) };
    const pendingCount = { $sum: { $map: { input: "$pendingReservations", as: "reservation", in: "$$reservation.count" } } };
    const updated = await DeviceQuota.findOneAndUpdate(
      { _id: quota._id, $expr: { $lte: [{ $add: ["$downloadsUsed", pendingCount] }, FREE_LIMIT - count] } },
      { $push: { pendingReservations: reservation } },
      { new: true }
    );
    if (!updated) {
      res.status(200).json({ success: true, allowed: false, authenticated: false, remaining: Math.max(0, FREE_LIMIT - quota.downloadsUsed) });
      return;
    }
    res.status(200).json({
      success: true,
      allowed: true,
      authenticated: false,
      reservationId,
      used: updated.downloadsUsed,
      remaining: Math.max(0, FREE_LIMIT - updated.downloadsUsed),
    });
  } catch (error) {
    console.error("[Device quota] Could not reserve quota:", error);
    res.status(500).json({ success: false, message: "Could not check the download limit." });
  }
}

export async function releaseDeviceQuota(req: Request, res: Response): Promise<void> {
  const reservationId = typeof req.body?.reservationId === "string" ? req.body.reservationId : "";
  if (!DEVICE_ID_PATTERN.test(reservationId)) {
    res.status(400).json({ success: false, message: "A valid reservation ID is required." });
    return;
  }
  try {
    if (await getSessionUser(req)) {
      res.status(200).json({ success: true });
      return;
    }
    const quota = await getGuestQuota(req, res);
    await DeviceQuota.updateOne({ _id: quota._id }, { $pull: { pendingReservations: { reservationId } } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Device quota] Could not release reservation:", error);
    res.status(500).json({ success: false, message: "Could not release the reserved download." });
  }
}

export async function commitDeviceQuota(req: Request, res: Response): Promise<{ used?: number; remaining?: number } | null> {
  const reservationId = typeof req.body?.reservationId === "string" ? req.body.reservationId : "";
  if (!reservationId) return null;
  const quota = await getGuestQuota(req, res);
  const reservation = quota.pendingReservations.find((entry) => entry.reservationId === reservationId && entry.expiresAt > new Date());
  if (!reservation) {
    res.status(409).json({ success: false, message: "Download reservation expired. Please try again." });
    return null;
  }
  const updated = await DeviceQuota.findOneAndUpdate(
    { _id: quota._id, pendingReservations: { $elemMatch: { reservationId, expiresAt: { $gt: new Date() } } } },
    { $inc: { downloadsUsed: reservation.count }, $pull: { pendingReservations: { reservationId } } },
    { new: true }
  );
  if (!updated) {
    res.status(409).json({ success: false, message: "Download reservation expired. Please try again." });
    return null;
  }
  return { used: updated.downloadsUsed, remaining: Math.max(0, FREE_LIMIT - updated.downloadsUsed) };
}
