import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
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
