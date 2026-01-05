const mongoose = require("mongoose");

const tokenBlocklistSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL cleanup (MongoDB must have TTL monitor running; default ~60s granularity)
tokenBlocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TokenBlocklist = mongoose.model("TokenBlocklist", tokenBlocklistSchema);

module.exports = { TokenBlocklist };

