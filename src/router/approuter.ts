
import express from "express";
import multer from "multer";
import { backgrounddownload, removeImageBackground } from "../controler/backgroundremoval";
import { adminUsers, createAdminAccount, currentUser, deleteAdminAccount, login, logout, register, sessionStatus, updateAdminAccount } from "../controler/login";
import {downloadCompressedImage, Imagecompressor} from '../controler/imagecompresser';
import { downloadimage, ImageConverter } from "../controler/imageconverter";
import { downloadBackground, saveBackground } from "../controler/backgroundchanger";
import { downloadCroppedImage, saveCroppedImage } from "../controler/imagecropper";
import { Bulkimage, DeleteBulkImage, DownloadAll, DownloadBulkImage, GetBulkImages, UpdateBulkImage } from "../controler/bulkimage";
import { AnalyzeImage,GetImageById,GetImages,UpdateImage,DeleteImage } from "../controler/imageanalyzer";
import {createImageControl,getImageControls,getImageControlById, updateImageControl, deleteImageControl,downloadImage} from "../controler/imagequalitycontrol";
import { DeleteDownload, DownloadZip, GetDownloadById, GetDownloadHistory, UpdateDownload } from "../controler/downloadzip";
import { deleteAdminDownloadActivity, getAdminDownloadActivity, getMyDownloadActivity, recordDownloadActivity } from "../controler/downloadaudit";
import { createRole, getRolePermissions, updateRolePermission } from "../controler/rolepermissions";
import { getImageTools,createImageTool,updateImageTool,updateImageToolStatus,deleteImageTool } from "../controler/ImageToolController";
import { createBackgroundBlur, backgrounddownload as downloadBackgroundBlur } from "../controler/backgroundblur";
import { consumeDeviceQuota, getDeviceQuota, releaseDeviceQuota } from "../controler/devicequota";
const router = express.Router();
const preventCaching: express.RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Users API is running",
  });
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", preventCaching, currentUser);
router.get("/session-status", preventCaching, sessionStatus);
router.post("/logout", logout);
router.get("/admin/users", adminUsers);
router.post("/admin/users", createAdminAccount);
router.patch("/admin/users/:id", updateAdminAccount);
router.delete("/admin/users/:id", deleteAdminAccount);
router.post("/download-activity", recordDownloadActivity);
router.get("/download-quota", getDeviceQuota);
router.post("/download-quota/consume", consumeDeviceQuota);
router.post("/download-quota/release", releaseDeviceQuota);
router.get("/my/downloads", preventCaching, getMyDownloadActivity);
router.get("/admin/downloads", getAdminDownloadActivity);
router.delete("/admin/downloads/:id", deleteAdminDownloadActivity);
router.get("/admin/permissions", getRolePermissions);
router.patch("/admin/permissions", updateRolePermission);
router.post("/admin/roles", createRole);

const upload = multer({
  storage: multer.memoryStorage(),
 
});

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

router.post("/remove-background", upload.single("image"), removeImageBackground);
router.get("/backgrounddownload/:filename", backgrounddownload);

router.post("/background-blur",upload.fields([{ name: "image", maxCount: 1 },{ name: "subject", maxCount: 1 },]),createBackgroundBlur);
router.get("/background-blur/download/:id", downloadBackgroundBlur);

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

router.get("/imagetools", getImageTools);
router.post("/imagetool", createImageTool);
router.patch("/imagetool/:id", updateImageTool);
router.patch("/imagetool/:id/status", updateImageToolStatus);
router.delete("/imagetool/:id", deleteImageTool);

router.get("/admin/imagetools", getImageTools);
router.post("/admin/imagetools", createImageTool);
router.patch("/admin/imagetools/:id", updateImageTool);
router.patch("/admin/imagetools/:id/status", updateImageToolStatus);
router.delete("/admin/imagetools/:id", deleteImageTool);

export default router;
