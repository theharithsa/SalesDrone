import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./contracts.js";
export function requireCursorSecret(value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("CURSOR_SECRET is required for production pagination");
  return value;
}
export function createCursorCodec(secret, { allowEphemeral = false } = {}) {
  const localKey =
    allowEphemeral && !secret ? randomBytes(32).toString("hex") : null;
  if (typeof secret !== "function") requireCursorSecret(secret || localKey);
  const sign = (value) =>
    createHmac(
      "sha256",
      requireCursorSecret(
        typeof secret === "function" ? secret() : secret || localKey,
      ),
    )
      .update(value)
      .digest("base64url");
  return {
    encode(after, binding) {
      const value = Buffer.from(JSON.stringify({ after, binding })).toString(
        "base64url",
      );
      return `${value}.${sign(value)}`;
    },
    decode(value, binding) {
      try {
        const [data, signature, ...extra] = value.split(".");
        const expected = sign(data);
        if (
          extra.length ||
          !signature ||
          Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
        )
          throw Error();
        const cursor = JSON.parse(Buffer.from(data, "base64url").toString());
        if (cursor.binding !== binding || !Array.isArray(cursor.after))
          throw Error();
        return cursor.after;
      } catch {
        throw new AppError(
          400,
          "CURSOR",
          "Invalid or expired cursor for these filters",
        );
      }
    },
  };
}
