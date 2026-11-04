
import express from "express";
import multer from "multer";

// Controllers - Authentication & Users
import {
  adminUsers,
  createAdminAccount,
  currentUser,
  deleteAdminAccount,
  login,
  logout,
  register,
  sessionStatus,
  updateAdminAccount,
} from "../controler/login";

// Controllers - Image Background Remover
import {
  backgrounddownload,
  removeImageBackground,
} from "../controler/backgroundremoval";

// Controllers - Image Compressor
import {
  downloadCompressedImage,
  Imagecompressor,
} from "../controler/imagecompresser";

// Controllers - Image Converter
import {
  downloadimage,
  ImageConverter,
} from "../controler/imageconverter";

// Controllers - Background Changer
import {
  downloadBackground,
  saveBackground,
} from "../controler/backgroundchanger";

// Controllers - Image Cropper
import {
  downloadCroppedImage,
  saveCroppedImage,
} from "../controler/imagecropper";

// Controllers - Bulk Image
import {
  Bulkimage,
  DeleteBulkImage,
  DownloadAll,
  DownloadBulkImage,
  GetBulkImages,
  UpdateBulkImage,
} from "../controler/bulkimage";

// Controllers - Image Analyzer
import {
  AnalyzeImage,
  GetImageById,
  GetImages,
  UpdateImage,
  DeleteImage,
} from "../controler/imageanalyzer";

// Controllers - Image Quality Control
import {
  createImageControl,
  getImageControls,
  getImageControlById,
  updateImageControl,
  deleteImageControl,
  downloadImage,
} from "../controler/imagequalitycontrol";

// Controllers - Download ZIP
import {
  DeleteDownload,
  DownloadZip,
  GetDownloadById,
  GetDownloadHistory,
  UpdateDownload,
} from "../controler/downloadzip";

// Controllers - Download Activity
import {
  deleteAdminDownloadActivity,
  getAdminDownloadActivity,
  getMyDownloadActivity,
  recordDownloadActivity,
} from "../controler/downloadaudit";

// Controllers - RBAC
import {
  createRole,
  getRolePermissions,
  updateRolePermission,
} from "../controler/rolepermissions";

// Controllers - Image Tools Management
import {
  getImageTools,
  createImageTool,
  updateImageTool,
  updateImageToolStatus,
  deleteImageTool,
} from "../controler/ImageToolController";

// Controllers - Background Blur
import {
  createBackgroundBlur,
  backgrounddownload as downloadBackgroundBlur,
} from "../controler/backgroundblur";

// Controllers - Device Quota
import {
  consumeDeviceQuota,
  getDeviceQuota,
  releaseDeviceQuota,
} from "../controler/devicequota";


const router = express.Router();


// ==========================================
// MIDDLEWARE
// ==========================================

const preventCaching: express.RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};


// ==========================================
// MULTER CONFIGURATION
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
});

const analyzerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

const uploadAnalyzerImage = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  analyzerUpload.single("image")(req, res, (error: unknown) => {
    if (error) {
      const isTooLarge =
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE";

      res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge
          ? "Images must be 25 MB or smaller."
          : "Upload one image using the 'image' field.",
      });

      return;
    }

    next();
  });
};


// ==========================================
// API HEALTH CHECK
// ==========================================

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Users API is running",
  });
});


// ==========================================
// AUTHENTICATION & USER ROUTES
// ==========================================

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.get("/me", preventCaching, currentUser);
router.get("/session-status", preventCaching, sessionStatus);

router.get("/admin/users", adminUsers);
router.post("/admin/users", createAdminAccount);
router.patch("/admin/users/:id", updateAdminAccount);
router.delete("/admin/users/:id", deleteAdminAccount);


// ==========================================
// RBAC - ROLE & PERMISSION ROUTES
// ==========================================

// Get all roles and their permissions
router.get("/admin/permissions", getRolePermissions);

// Update role permissions
router.patch("/admin/permissions", updateRolePermission);

// Create new role
router.post("/admin/roles", createRole);


// ==========================================
// DOWNLOAD QUOTA ROUTES
// ==========================================

router.get("/download-quota", getDeviceQuota);
router.post("/download-quota/consume", consumeDeviceQuota);
router.post("/download-quota/release", releaseDeviceQuota);


// ==========================================
// DOWNLOAD ACTIVITY ROUTES
// ==========================================

router.post("/download-activity", recordDownloadActivity);

router.get("/my/downloads", preventCaching, getMyDownloadActivity);

router.get("/admin/downloads", getAdminDownloadActivity);
router.delete("/admin/downloads/:id", deleteAdminDownloadActivity);


// ==========================================
// IMAGE BACKGROUND REMOVER
// ==========================================

router.post(
  "/remove-background",
  upload.single("image"),
  removeImageBackground
);

router.get("/backgrounddownload/:filename", backgrounddownload);


// ==========================================
// BACKGROUND BLUR
// ==========================================

router.post(
  "/background-blur",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "subject", maxCount: 1 },
  ]),
  createBackgroundBlur
);

router.get("/background-blur/download/:id", downloadBackgroundBlur);


// ==========================================
// IMAGE CONVERTER
// ==========================================

router.post(
  "/image-converter",
  upload.single("image"),
  ImageConverter
);

router.get("/downloadconverter/:id", downloadimage);


// ==========================================
// IMAGE COMPRESSOR
// ==========================================

router.post(
  "/image-compresser",
  upload.single("image"),
  Imagecompressor
);

router.get("/downloadimage/:id", downloadCompressedImage);


// ==========================================
// BACKGROUND CHANGER
// ==========================================

router.post(
  "/savebackground",
  upload.single("image"),
  saveBackground
);

router.get("/downloadbackground/:id", downloadBackground);


// ==========================================
// IMAGE CROPPER
// ==========================================

router.post(
  "/image-cropper",
  upload.single("image"),
  saveCroppedImage
);

router.get("/downloadcropper/:id", downloadCroppedImage);


// ==========================================
// BULK IMAGE PROCESSING
// ==========================================

router.post("/bulkimage", upload.single("image"), Bulkimage);

router.get("/bulkimages", GetBulkImages);

router.patch(
  "/bulkimage/:id",
  upload.single("image"),
  UpdateBulkImage
);

router.delete("/bulkimage/:id", DeleteBulkImage);

router.get("/downloadbulk/:id", DownloadBulkImage);

router.get("/download", DownloadAll);


// ==========================================
// IMAGE ANALYZER
// ==========================================

router.post(
  "/image-analyzer",
  uploadAnalyzerImage,
  AnalyzeImage
);

router.post(
  "/analyze-image",
  upload.single("image"),
  AnalyzeImage
);

router.get("/analyze-image", GetImages);
router.get("/analyze-image/:id", GetImageById);
router.patch("/analyze-image/:id", UpdateImage);
router.delete("/analyze-image/:id", DeleteImage);


// ==========================================
// IMAGE QUALITY CONTROL
// ==========================================

router.post(
  "/compress-image",
  upload.single("image"),
  createImageControl
);

router.get("/compress-image", getImageControls);
router.get("/compress-image/:id", getImageControlById);
router.patch("/compress-image/:id", updateImageControl);
router.delete("/compress-image/:id", deleteImageControl);

router.get("/download-image/:id", downloadImage);


// ==========================================
// DOWNLOAD ZIP
// ==========================================

router.post(
  "/downloadzip",
  upload.array("files", 20),
  DownloadZip
);

router.get("/getdownload", GetDownloadHistory);
router.get("/getdownload/:id", GetDownloadById);

router.patch("/updatedownload/:id", UpdateDownload);
router.delete("/deleted/:id", DeleteDownload);


// ==========================================
// IMAGE TOOLS MANAGEMENT
// ==========================================

// General image tools
router.get("/imagetools", getImageTools);
router.post("/imagetool", createImageTool);
router.patch("/imagetool/:id", updateImageTool);
router.patch("/imagetool/:id/status", updateImageToolStatus);
router.delete("/imagetool/:id", deleteImageTool);

// Admin image tools
router.get("/admin/imagetools", getImageTools);
router.post("/admin/imagetools", createImageTool);
router.patch("/admin/imagetools/:id", updateImageTool);
router.patch("/admin/imagetools/:id/status", updateImageToolStatus);
router.delete("/admin/imagetools/:id", deleteImageTool);


export default router;
