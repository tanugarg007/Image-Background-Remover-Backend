
import express from "express";
import multer from "multer";
import { removeBackground } from "../controler/backgroundremoval";
import {downloadCompressedImage, Imagecompressor} from '../controler/imagecompresser';
import { downloadimage, ImageConverter } from "../controler/imageconverter";
import { downloadBackground, saveBackground } from "../controler/backgroundchanger";
import { downloadCroppedImage, saveCroppedImage } from "../controler/imagecropper";
import { Bulkimage, DeleteBulkImage, DownloadAll, DownloadBulkImage, GetBulkImages, UpdateBulkImage } from "../controler/bulkimage";
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
 
});

router.post( "/remove-background", upload.single("image"), removeBackground);
router.post("/image-converter",upload.single("image"),ImageConverter);
router.get('/downloadconverter/:id', downloadimage)
router.post('/image-compresser', upload.single('image'), Imagecompressor)
router.get('/downloadimage/:id', downloadCompressedImage)
router.post('/savebackground',upload.single('image'), saveBackground)
router.get('/downloadbackground/:id', downloadBackground)
router.post('/image-cropper', upload.single('image'), saveCroppedImage)
router.get('/downloadcropper/:id', downloadCroppedImage)
router.post('/bulkimage', Bulkimage)
router.get('/bulkimages', GetBulkImages)
router.patch('/bulkimage/:id', UpdateBulkImage)
router.delete('/bulkimage/:id', DeleteBulkImage)
router.get('/downloadbulk/:id', DownloadBulkImage)
router.get('/download', DownloadAll)
export default router;
