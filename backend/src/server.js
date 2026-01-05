require("dotenv").config();

const http = require("http");
const { createApp } = require("./app");
const { connectDB } = require("./config/db");

async function start() {
  const port = Number(process.env.PORT || 5000);

  const conn = await connectDB(process.env.MONGODB_URI);
  conn.once("connected", () => {
    console.log("MongoDB connected");
  });

  const app = createApp();
  const server = http.createServer(app);

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Set PORT in .env to a free port.`);
      process.exit(1);
    }
    console.error("Server error:", err);
    process.exit(1);
  });

  server.listen(port, () => {
    // Intentionally minimal to keep logs clean in production
    console.log(`Quizelo API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exitCode = 1;
});

