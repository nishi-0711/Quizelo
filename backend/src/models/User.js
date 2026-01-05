const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => EMAIL_RE.test(v),
        message: "Invalid email",
      },
    },
    passwordHash: { type: String, required: true, select: false },
    streak: { type: Number, default: 0 },
    lastQuizDate: { type: Date },
  },
  { timestamps: true }
);
userSchema.statics.hashPassword = async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

userSchema.methods.verifyPassword = async function verifyPassword(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    streak: this.streak || 0,
    lastQuizDate: this.lastQuizDate,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

module.exports = { User };

