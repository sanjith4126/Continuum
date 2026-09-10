import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
// 18 random bytes, base64url-encoded -> 24 chars, well within the 12-128
// bound hashPassword enforces. Same generation approach already used by
// scripts/bootstrap-accounts.js for the initial account passwords.
export function generateTempPassword() {
 return randomBytes(18).toString("base64url");
}
export async function hashPassword(password: string) {
 if (password.length < 12 || password.length > 128) throw new Error("Use a password between 12 and 128 characters.");
 const salt = randomBytes(16).toString("hex");
 const hash = await derive(password, salt, 64) as Buffer;
 return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
 if (password.length > 128) return false;
 const [salt, hex] = stored.split(":");
 if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
 const hash = await derive(password, salt, 64) as Buffer;
 return timingSafeEqual(hash, Buffer.from(hex,"hex"));
}
