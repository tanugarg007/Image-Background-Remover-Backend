
import express from "express";
import multer from "multer";
import { backgrounddownload, removeBackground } from "../controler/backgroundremoval";
import {downloadCompressedImage, Imagecompressor} from '../controler/imagecompresser';
import { downloadimage, ImageConverter } from "../controler/imageconverter";
import { downloadBackground, saveBackground } from "../controler/backgroundchanger";
import { downloadCroppedImage, saveCroppedImage } from "../controler/imagecropper";
import { Bulkimage, DeleteBulkImage, DownloadAll, DownloadBulkImage, GetBulkImages, UpdateBulkImage } from "../controler/bulkimage";
import { AnalyzeImage,GetImageById,GetImages,UpdateImage,DeleteImage } from "../controler/imageanalyzer";
import {createImageControl,getImageControls,getImageControlById, updateImageControl, deleteImageControl,downloadImage} from "../controler/imagequalitycontrol";
import { DeleteDownload, DownloadZip, GetDownloadById, GetDownloadHistory, UpdateDownload } from "../controler/downloadzip";
const router = express.Router();

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
router.post( "/remove-background", upload.single("image"), removeBackground);
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
router.put("/analyze-image/:id", UpdateImage);
router.delete("/analyze-image/:id", DeleteImage);
router.post("/compress-image", upload.single('image'), createImageControl);
router.get("/compress-image", getImageControls);
router.get("/compress-image/:id", getImageControlById);
router.put("/compress-image/:id", updateImageControl);
router.delete("/compress-image/:id", deleteImageControl);
router.get("/download-image/:id", downloadImage);
router.post("/downloadzip", upload.array("files", 20), DownloadZip);
router.get('/getdownload',GetDownloadHistory )
router.get('/getdownload/:id',GetDownloadById)
router.patch("/updatedownload/:id",UpdateDownload)
router.delete('/deleted/:id',DeleteDownload)
export default router;
