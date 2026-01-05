const { verifyAccessToken } = require("../utils/jwt");
const { TokenBlocklist } = require("../models/TokenBlocklist");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing Authorization header" });

    const payload = verifyAccessToken(token);
    if (!payload?.jti) return res.status(401).json({ error: "Invalid token" });

    const blocked = await TokenBlocklist.exists({ jti: payload.jti });
    if (blocked) return res.status(401).json({ error: "Token revoked" });

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
      token,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };

