const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  return mongoose.connection;
}

module.exports = { connectDB };

