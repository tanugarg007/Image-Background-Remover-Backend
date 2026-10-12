import mongoose from "mongoose";
export interface IBackgroundRemoval {
    imageUrl: string;
    processedImageUrl: string;
}

const backgroundRemovalSchema = new mongoose.Schema({
    imageUrl: {
        type: String,
        required: true
    },
    processedImageUrl: {
        type: String,
        required: true
    }
});

const BackgroundRemovalModel = mongoose.model("BackgroundRemoval", backgroundRemovalSchema);
export default BackgroundRemovalModel;