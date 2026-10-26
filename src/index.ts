import express from "express";
import cors from "cors";
import { exit } from "node:process";
import Router from "./router/approuter";
import { connectDB } from "./config/db";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://image-background-remover-frontend-z.vercel.app",
      "https://image-background-remover-frontend-g8jiyp6gy.vercel.app",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/users", Router);

app.get("/ping", (_req, res) => {
  res.send("PING WORKING");
});

app.get("/users/test", (_req, res) => {
  res.json({ message: "Backend route working" });
});

app.listen(4000, () => {
  console.log("Server is running on port 4000");
});

connectDB().catch((error: unknown) => {
  console.error("MongoDB connection failed:", error);
  exit(1);
});
