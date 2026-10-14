
import { Request, Response } from "express";
import {removeBackground as removeImageBackground} from "@imgly/background-removal-node";

export const removeBackground = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        message: "Please upload an image.",
      });
      return;
    }

    // Step 1: Check uploaded image details
    console.log("Uploaded image:", {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Step 2: Create Blob with the image MIME type
   
const imageBytes = new Uint8Array(req.file.buffer);

const imageBlob = new Blob([imageBytes], {
  type: req.file.mimetype,
});

console.log("Image MIME type:", imageBlob.type);


const result = await removeImageBackground(imageBlob, {
  model: "medium",
  output: {
    format: "image/png",
    
  },
});

    console.log("Image MIME type:", imageBlob.type);

   
    // Step 4: Convert result to Buffer
    const outputBuffer = Buffer.from(
      await result.arrayBuffer()
    );

    // Step 5: Send transparent PNG to frontend
    res.setHeader("Content-Type", "image/png");
    // res.setHeader(
    //   "Content-Disposition",
    //   'inline; filename="background-removed.png"'
    // );

    res.status(200).send(outputBuffer);
  } catch (error: unknown) {
    console.error("Background removal failed:", error);

    res.status(500).json({
      message: "Background removal failed",
      error:
        error instanceof Error
          ? error.stack || error.message
          : String(error),
    });
  }
};
