
import express from "express";
import multer from "multer";
import { removeBackground } from "../controler/backgroundremoval";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
  "/remove-background",
  upload.single("image"),
  removeBackground
);

export default router;
