
import express from "express";
import multer from "multer";
import { backgrounddownload } from "../controler/backgroundremoval";
import { createBackgroundBlur } from "../controler/backgroundblur";
import { adminUsers, createAdminAccount, currentUser, login, logout, register, updateAdminAccount } from "../controler/login";
import {downloadCompressedImage, Imagecompressor} from '../controler/imagecompresser';
import { downloadimage, ImageConverter } from "../controler/imageconverter";
import { downloadBackground, saveBackground } from "../controler/backgroundchanger";
import { downloadCroppedImage, saveCroppedImage } from "../controler/imagecropper";
import { Bulkimage, DeleteBulkImage, DownloadAll, DownloadBulkImage, GetBulkImages, UpdateBulkImage } from "../controler/bulkimage";
import { AnalyzeImage,GetImageById,GetImages,UpdateImage,DeleteImage } from "../controler/imageanalyzer";
import {createImageControl,getImageControls,getImageControlById, updateImageControl, deleteImageControl,downloadImage} from "../controler/imagequalitycontrol";
import { DeleteDownload, DownloadZip, GetDownloadById, GetDownloadHistory, UpdateDownload } from "../controler/downloadzip";
import { deleteAdminDownloadActivity, getAdminDownloadActivity, recordDownloadActivity } from "../controler/downloadaudit";
import { createRole, getRolePermissions, updateRolePermission } from "../controler/rolepermissions";
import { getImageTools,createImageTool,updateImageTool,updateImageToolStatus,deleteImageTool } from "../controler/ImageToolController";
const router = express.Router();
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Users API is running",
  });
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", currentUser);
router.post("/logout", logout);
router.get("/admin/users", adminUsers);
router.post("/admin/users", createAdminAccount);
router.patch("/admin/users/:id", updateAdminAccount);
router.post("/download-activity", recordDownloadActivity);
router.get("/admin/downloads", getAdminDownloadActivity);
router.delete("/admin/downloads/:id", deleteAdminDownloadActivity);
router.get("/admin/permissions", getRolePermissions);
router.patch("/admin/permissions", updateRolePermission);
router.post("/admin/roles", createRole);

const upload = multer({
  storage: multer.memoryStorage(),
 
});

const backgroundBlurUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 2 },
});

const uploadBackgroundBlurImages = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  backgroundBlurUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "subject", maxCount: 1 },
  ])(req, res, (error: unknown) => {
    if (error) {
      const isTooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge
          ? "Each uploaded image must be 20 MB or smaller."
          : "Upload one original image and one transparent PNG subject.",
      });
      return;
    }
    next();
  });
};

const analyzerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

const uploadAnalyzerImage = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  analyzerUpload.single("image")(req, res, (error: unknown) => {
    if (error) {
      const isTooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge ? "Images must be 25 MB or smaller." : "Upload one image using the 'image' field.",
      });
      return;
    }
    next();
  });
};

router.post("/image-analyzer", uploadAnalyzerImage, AnalyzeImage);
router.post("/background-blur", uploadBackgroundBlurImages, createBackgroundBlur);

router.get('/backgrounddownload/:filename', backgrounddownload )

router.post("/image-converter",upload.single("image"),ImageConverter);
router.get('/downloadconverter/:id', downloadimage)

router.post('/image-compresser', upload.single('image'), Imagecompressor)
router.get('/downloadimage/:id', downloadCompressedImage)
router.post('/savebackground',upload.single('image'), saveBackground)
router.get('/downloadbackground/:id', downloadBackground)

router.post('/image-cropper', upload.single('image'), saveCroppedImage)
router.get('/downloadcropper/:id', downloadCroppedImage)

router.post('/bulkimage', upload.single('image'), Bulkimage)
router.get('/bulkimages', GetBulkImages)
router.patch('/bulkimage/:id',upload.single('image'), UpdateBulkImage)
router.delete('/bulkimage/:id', DeleteBulkImage)
router.get('/downloadbulk/:id', DownloadBulkImage)
router.get('/download', DownloadAll)

router.post("/analyze-image",upload.single("image"),AnalyzeImage);
router.get("/analyze-image", GetImages);
router.get("/analyze-image/:id", GetImageById);
router.patch("/analyze-image/:id", UpdateImage);
router.delete("/analyze-image/:id", DeleteImage);

router.post("/compress-image", upload.single('image'), createImageControl);
router.get("/compress-image", getImageControls);
router.get("/compress-image/:id", getImageControlById);
router.patch("/compress-image/:id", updateImageControl);
router.delete("/compress-image/:id", deleteImageControl);

router.get("/download-image/:id", downloadImage);
router.post("/downloadzip", upload.array("files", 20), DownloadZip);
router.get('/getdownload',GetDownloadHistory )
router.get('/getdownload/:id',GetDownloadById)
router.patch("/updatedownload/:id",UpdateDownload)
router.delete('/deleted/:id',DeleteDownload)

router.get("/admin/imagetools", getImageTools);
router.post("/admin/imagetools", createImageTool);
router.patch("/admin/imagetools/:id", updateImageTool);
router.patch("/admin/imagetools/:id/status", updateImageToolStatus);
router.delete("/admin/imagetools/:id", deleteImageTool);

export default router;
