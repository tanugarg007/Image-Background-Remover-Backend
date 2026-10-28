
import express from "express";
import cors from "cors";
import { exit } from "node:process";
import Router from "./router/approuter";
import { connectDB } from "./config/db";

const app = express();

// The API does not use cookies, so allow browser clients from any origin.
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/ping", (_req, res) => {
  res.status(200).send("PING WORKING");
});

app.use("/users", (req, res, next) => {
  console.log("[REQUEST]", req.method, req.originalUrl);
  next();
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

// Return JSON for errors raised by route middleware instead of Express's
// default HTML error page.
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("[API] Unhandled request error:", error);
    if (res.headersSent) {
      next(error);
      return;
    }

    const statusCode =
      typeof error === "object" && error !== null && "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? "Internal server error." : "Request failed.",
    });
  }
);

const PORT = process.env.PORT || 4000;

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});

connectDB().catch((error: unknown) => {
  console.error("MongoDB connection failed:", error);
  exit(1);
});
