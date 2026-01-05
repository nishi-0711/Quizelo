const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

function signAccessToken({ userId, email }) {
  const jti = crypto.randomUUID();
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const token = jwt.sign({ sub: userId, email, jti }, secret, { expiresIn });
  return { token, jti };
}

function verifyAccessToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = { signAccessToken, verifyAccessToken, decodeToken };

