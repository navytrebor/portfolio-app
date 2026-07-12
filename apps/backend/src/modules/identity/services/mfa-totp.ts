import { randomBytes, createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error("Invalid base32 secret");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

export function generateTotpCode(secret: string, now = Date.now()): string {
  const currentCounter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(secret, currentCounter);
}

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

export function createOtpAuthUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent("Portfolio App");
  const label = encodeURIComponent(`Portfolio App:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function verifyTotpCode(secret: string, candidate: string, now = Date.now()): boolean {
  const trimmed = candidate.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return false;
  }

  try {
    const currentCounter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
    for (const offset of [-1, 0, 1]) {
      if (hotp(secret, currentCounter + offset) === trimmed) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}