const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const routes = require("./routes");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Configure CORS based on NODE_ENV
  let corsOptions = {
    credentials: true,
  };

  if (process.env.CORS_ORIGIN === "*" || !process.env.CORS_ORIGIN) {
    // Wildcard for development
    corsOptions.origin = true;
    corsOptions.credentials = false;
  } else {
    // Specific origins from ENV (comma-separated)
    const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((s) => s.trim());
    corsOptions.origin = allowedOrigins;
  }

  app.use(cors(corsOptions));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use("/api", routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: status === 500 ? "Internal Server Error" : err.message,
    });
  });

  return app;
}

module.exports = { createApp };

