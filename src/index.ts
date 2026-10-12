import express from "express";
import cors from "cors";
import { exit } from "node:process";
import Router from "./router/approuter";
import { connectDB } from "./config/db";

const app = express();
app.use(cors());
const corsOptions = {
    origin: "*", // Allow requests from any origin
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allow specific HTTP methods
    allowedHeaders: "Content-Type, Authorization", // Allow specific headers
};
app.use(cors(corsOptions)); 
app.use("/users", Router);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
    res.json({ message: "Hello, World!" });
});
app.listen(4000, () => {
    console.log("Server is running on port 4000");
});

connectDB().catch((error: unknown) => {
    console.error("MongoDB connection failed:", error);
    exit(1);
});
