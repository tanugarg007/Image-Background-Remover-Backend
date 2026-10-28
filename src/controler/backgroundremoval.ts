
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  removeBackground as removeImageBackground,
} from "@imgly/background-removal-node";
import sharp from "sharp";

const outputDir = path.resolve(
  process.cwd(),
  "uploads",
  "removed-backgrounds"
);

type RemovalJob = {
  id: string;
  createdAt: number;
  status: "processing" | "completed" | "failed";
  filename?: string;
  message?: string;
};

const removalJobs = new Map<string, RemovalJob>();
let activeRemovalJob: string | null = null;
const JOB_TTL_MS = 30 * 60 * 1000;

const pruneExpiredJobs = (): void => {
  const expiry = Date.now() - JOB_TTL_MS;
  for (const [jobId, job] of removalJobs) {
    if (job.createdAt < expiry) removalJobs.delete(jobId);
  }
};

const processBackgroundRemoval = async (
  jobId: string,
  inputBuffer: Buffer,
  createdAt: number
): Promise<void> => {
  try {
    console.log("[Background] Resizing input image");
    const resizedBuffer = await sharp(inputBuffer)
      .resize({
        width: 512,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    const imageBlob = new Blob([new Uint8Array(resizedBuffer)], {
      type: "image/jpeg",
    });

    console.log("[Background] Starting inference for job:", jobId);
    console.log("[Background] Memory before inference:", {
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });

    const result = await removeImageBackground(imageBlob, {
      model: "small",
      output: { format: "image/png" },
      progress: (key, current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        console.log(`[Background] ${key}: ${percent}%`);
      },
    });

    const outputBuffer = Buffer.from(await result.arrayBuffer());
    await fs.mkdir(outputDir, { recursive: true });

    const filename = `background-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.png`;
    await fs.writeFile(path.join(outputDir, filename), outputBuffer);

    removalJobs.set(jobId, { id: jobId, createdAt, status: "completed", filename });
    console.log("[Background] Processing completed:", filename);
    console.log("[Background] Memory after inference:", {
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (error) {
    console.error("[Background] Processing failed:", error);
    removalJobs.set(jobId, {
      id: jobId,
      createdAt,
      status: "failed",
      message: "Background removal failed. Please try a smaller image or retry.",
    });
  } finally {
    activeRemovalJob = null;
  }
};

// 1. Remove background and save PNG
export const removeBackground = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log("[Background] Request received");
  if (!req.file) {
    res.status(400).json({ success: false, message: "Please upload an image." });
    return;
  }

  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ success: false, message: "Please upload a valid image." });
    return;
  }

  if (activeRemovalJob) {
    res.setHeader("Retry-After", "10");
    res.status(503).json({
      success: false,
      message: "Another image is being processed. Please retry shortly.",
    });
    return;
  }

  pruneExpiredJobs();
  const jobId = randomUUID();
  const createdAt = Date.now();
  activeRemovalJob = jobId;
  removalJobs.set(jobId, { id: jobId, createdAt, status: "processing" });

  res.status(202).json({ success: true, jobId, status: "processing" });
  void processBackgroundRemoval(jobId, req.file.buffer, createdAt);
};

export const backgroundRemovalStatus = (
  req: Request,
  res: Response
): void => {
  const rawJobId = req.params.jobId;
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
  const job = jobId ? removalJobs.get(jobId) : undefined;

  if (!job) {
    res.status(404).json({ success: false, message: "Background-removal job not found." });
    return;
  }

  res.status(200).json(job);
};

// 2. Download processed PNG
export const backgrounddownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawFilename = req.params.filename;

    const filename = Array.isArray(rawFilename)
      ? rawFilename[0]
      : rawFilename;

    // Validate filename to prevent path traversal
    if (
      !filename ||
      !/^background-[a-zA-Z0-9-]+\.png$/.test(filename)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid image filename.",
      });
      return;
    }

    const filePath = path.join(outputDir, filename);

    let fileStats;

    try {
      fileStats = await fs.stat(filePath);
    } catch {
      res.status(404).json({
        success: false,
        message: "Processed image not found.",
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "no-store");

    const imageStream = createReadStream(filePath);

    imageStream.on("error", (error) => {
      console.error("[Download] Stream failed:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to download image.",
        });
      } else {
        res.destroy(error);
      }
    });

    imageStream.pipe(res);
  } catch (error: unknown) {
    console.error("[Download] Failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Download failed.",
      });
    }
  }
};
