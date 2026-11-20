import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import DeviceIdentity from "../models/deviceidentity";
import DeviceQuota from "../models/devicequota";
import { getSessionUser } from "../midleware/sessionuser";

const FREE_LIMIT = 3;
const DEVICE_COOKIE = "citc_guest_device_v2";
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
  const headerDeviceId = req.get("X-Guest-Device");
  // The frontend ID is scoped to its origin's localStorage. Prefer it over
  // the cookie because localhost cookies are shared across ports, which can
  // otherwise make one local app inherit another app's exhausted quota.
  const deviceId = headerDeviceId && DEVICE_ID_PATTERN.test(headerDeviceId)
    ? headerDeviceId.toLowerCase()
    : existing && DEVICE_ID_PATTERN.test(existing)
      ? existing.toLowerCase()
      : randomUUID();
  const secure = req.secure ? "; Secure" : "";
  if (!existing || existing.toLowerCase() !== deviceId) {
    res.append("Set-Cookie", `${DEVICE_COOKIE}=${encodeURIComponent(deviceId)}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax${secure}`);
  }
  return deviceId;
}

async function getOrCreateQuota(deviceId: string) {
  const identity = await DeviceIdentity.findOne({ deviceId });
  if (identity) {
    const quota = await DeviceQuota.findById(identity.quotaId);
    if (quota) {
      // Older deployments may have linked several browser IDs to one quota.
      // Never let one browser inherit another browser's usage or reservations.
      const otherDevices = await DeviceIdentity.countDocuments({
        quotaId: quota._id,
        deviceId: { $ne: deviceId },
      });
      if (otherDevices === 0) return quota;

      // Legacy shared usage and reservations cannot be attributed to a browser.
      // Give this identity a clean quota so a first visit gets the full limit.
      const detachedQuota = await DeviceQuota.create({
        downloadsUsed: 0,
        remainingDownloads: FREE_LIMIT,
      });
      const detached = await DeviceIdentity.updateOne(
        { _id: identity._id, quotaId: quota._id },
        { $set: { quotaId: detachedQuota._id } }
      );
      if (detached.modifiedCount === 1) return detachedQuota;

      await DeviceQuota.deleteOne({ _id: detachedQuota._id });
      const currentIdentity = await DeviceIdentity.findOne({ deviceId });
      const currentQuota = currentIdentity
        ? await DeviceQuota.findById(currentIdentity.quotaId)
        : null;
      if (currentQuota) return currentQuota;
      throw new Error("Could not load this browser's download quota.");
    }
    await DeviceIdentity.deleteOne({ _id: identity._id });
  }

  // Every new browser cookie gets its own quota, regardless of network/IP.
  // Initialize the full balance in the same write as the new identity. This
  // avoids a newly opened browser briefly reading an empty/zero balance while
  // the legacy-balance reconciliation runs below.
  const quota = await DeviceQuota.create({
    downloadsUsed: 0,
    remainingDownloads: FREE_LIMIT,
  });
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
  let quota = await getOrCreateQuota(deviceId);
  if (typeof quota.remainingDownloads !== "number") {
    const reserved = (quota.pendingReservations || [])
      .reduce((total, reservation) => total + (Number(reservation.count) || 0), 0);
    await DeviceQuota.updateOne(
      { _id: quota._id, remainingDownloads: { $exists: false } },
      { $set: { remainingDownloads: Math.max(0, FREE_LIMIT - quota.downloadsUsed - reserved) } }
    );
  }

  const now = new Date();
  const expired = (quota.pendingReservations || []).filter((reservation) => reservation.expiresAt <= now);
  for (const reservation of expired) {
    await DeviceQuota.updateOne(
      {
        _id: quota._id,
        pendingReservations: { $elemMatch: { reservationId: reservation.reservationId, expiresAt: { $lte: now } } },
      },
      {
        $pull: { pendingReservations: { reservationId: reservation.reservationId } },
        $inc: { remainingDownloads: reservation.count },
      }
    );
  }

  quota = (await DeviceQuota.findById(quota._id)) || quota;

  // Reconcile legacy or stale balances with completed downloads and active
  // reservations. This prevents old usage (for example 19 downloads) from
  // granting more free downloads than the current limit.
  const reserved = quota.pendingReservations.reduce(
    (total, reservation) => total + (Number(reservation.count) || 0),
    0
  );
  const expectedRemaining = Math.max(0, FREE_LIMIT - quota.downloadsUsed - reserved);
  if (quota.remainingDownloads !== expectedRemaining) {
    await DeviceQuota.updateOne(
      {
        _id: quota._id,
        downloadsUsed: quota.downloadsUsed,
        ...(quota.remainingDownloads === undefined
          ? { remainingDownloads: { $exists: false } }
          : { remainingDownloads: quota.remainingDownloads }),
      },
      { $set: { remainingDownloads: expectedRemaining } }
    );
    quota = (await DeviceQuota.findById(quota._id)) || quota;
  }
  return quota;
}

function sendQuota(res: Response, used: number, authenticated: boolean, remaining: number) {
  res.status(200).json({
    success: true,
    authenticated,
    limit: FREE_LIMIT,
    used,
    remaining: Math.max(0, remaining),
  });
}

export async function getDeviceQuota(req: Request, res: Response): Promise<void> {
  try {
    const authenticated = Boolean(await getSessionUser(req));
    const quota = await getGuestQuota(req, res);
    sendQuota(res, quota.downloadsUsed, authenticated, quota.remainingDownloads ?? Math.max(0, FREE_LIMIT - quota.downloadsUsed));
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
    const authenticated = Boolean(await getSessionUser(req));
    const quota = await getGuestQuota(req, res);
    const now = new Date();
    if (authenticated) {
      const reservationId = randomUUID();
      const reservation = { reservationId, count, expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) };
      const updated = await DeviceQuota.findOneAndUpdate(
        { _id: quota._id },
        { $push: { pendingReservations: reservation } },
        { new: true }
      );
      if (!updated) throw new Error("Could not reserve the signed-in download.");
      res.status(200).json({
        success: true,
        allowed: true,
        authenticated: true,
        reservationId,
        used: updated.downloadsUsed,
        remaining: updated.remainingDownloads ?? 0,
      });
      return;
    }
    if (count > FREE_LIMIT) {
      res.status(200).json({
        success: true,
        allowed: false,
        authenticated,
        remaining: quota.remainingDownloads ?? 0,
      });
      return;
    }
    const reservationId = randomUUID();
    const reservation = { reservationId, count, expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) };
    const updated = await DeviceQuota.findOneAndUpdate(
      { _id: quota._id, remainingDownloads: { $gte: count } },
      { $inc: { remainingDownloads: -count }, $push: { pendingReservations: reservation } },
      { new: true }
    );
    if (!updated) {
      const latestQuota = await DeviceQuota.findById(quota._id);
      res.status(200).json({
        success: true,
        allowed: false,
        authenticated,
        remaining: latestQuota?.remainingDownloads ?? quota.remainingDownloads ?? 0,
      });
      return;
    }
    res.status(200).json({
      success: true,
      allowed: true,
      authenticated,
      reservationId,
      used: updated.downloadsUsed,
      remaining: updated.remainingDownloads ?? 0,
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
    const quota = await getGuestQuota(req, res);
    const reservation = quota.pendingReservations.find((entry) => entry.reservationId === reservationId);
    if (reservation) {
      await DeviceQuota.updateOne(
        { _id: quota._id, pendingReservations: { $elemMatch: { reservationId } } },
        {
          $pull: { pendingReservations: { reservationId } },
          $inc: { remainingDownloads: reservation.count },
        }
      );
    }
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
  return { used: updated.downloadsUsed, remaining: updated.remainingDownloads ?? 0 };
}
