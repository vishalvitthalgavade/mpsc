require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const prisma = require("./config/prisma");

const authRoutes = require("./routes/authRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const studyRoutes = require("./routes/studyRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

/*
====================================================
CORS
====================================================
*/

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://gateex.vercel.app",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", origin);

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,
  })
);

/*
====================================================
MIDDLEWARE
====================================================
*/

app.use(express.json());

app.use(cookieParser());

/*
====================================================
ROOT
====================================================
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GATE CSE Tracker API is running",
  });
});

/*
====================================================
HEALTH CHECK
====================================================
*/

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      database: "disconnected",
    });
  }
});

/*
====================================================
AUTH ROUTES
====================================================
*/

app.use("/api/auth", authRoutes);

/*
====================================================
STUDY SESSION ROUTES
====================================================
*/

app.use("/api/sessions", sessionRoutes);

/*
====================================================
STUDY DATA ROUTES
====================================================
*/

app.use("/api/study", studyRoutes);

/*
====================================================
ADMIN ROUTES
====================================================
|
| All /api/admin routes are protected by:
|
| 1. JWT authentication
| 2. Active account check
| 3. ADMIN role check
|
====================================================
*/

app.use("/api/admin", adminRoutes);

/*
====================================================
START SERVER
====================================================
*/

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(
        `GATE CSE API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to connect to PostgreSQL:",
      error
    );

    process.exit(1);
  }
}

startServer();

/*
====================================================
GRACEFUL SHUTDOWN
====================================================
*/

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});