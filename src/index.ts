
import express from "express";
import cors from "cors";
import { exit } from "node:process";
import Router from "./router/approuter";
import { connectDB } from "./config/db";

const app = express();

app.use(
  cors({
    origin: [
      "https://image-background-remover-frontend-z.vercel.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/ping", (_req, res) => {
  res.status(200).send("PING WORKING");
});

app.use("/users", Router);

app.get("/users/test", (_req, res) => {
  res.json({ message: "Backend route working" });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Image Background Remover API is running",
  });
});

const PORT = process.env.PORT || 4000;

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});

connectDB().catch((error: unknown) => {
  console.error("MongoDB connection failed:", error);
  exit(1);
});
