import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
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
  const opaqueKey=()=>createHmac('sha256',requireCursorSecret(typeof secret==='function'?secret():secret||localKey)).update('salesdrone-accessible-task-cursor-v1').digest();
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
    seal(after,binding){
      const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',opaqueKey(),nonce);cipher.setAAD(Buffer.from(binding));
      const encrypted=Buffer.concat([cipher.update(JSON.stringify(after),'utf8'),cipher.final()]);
      return ['v2',nonce.toString('base64url'),encrypted.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
    },
    open(value,binding){
      try{
        if(value.length>2048)throw Error();
        const [version,nonce,data,tag,...extra]=value.split('.');if(version!=='v2'||extra.length)throw Error();
        const decipher=createDecipheriv('aes-256-gcm',opaqueKey(),Buffer.from(nonce,'base64url'));decipher.setAAD(Buffer.from(binding));decipher.setAuthTag(Buffer.from(tag,'base64url'));
        const after=JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8'));if(!Array.isArray(after))throw Error();return after;
      }catch{throw new AppError(400,'CURSOR','Invalid or expired cursor for these filters');}
    },
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
