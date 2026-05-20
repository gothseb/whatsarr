import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

@Injectable()
export class EncryptionService {
  encrypt(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString("base64url"),
      authTag.toString("base64url"),
      encrypted.toString("base64url")
    ].join(".");
  }

  decrypt(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const [iv, authTag, encrypted] = value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }
}

function getEncryptionKey() {
  const explicit = process.env.APP_ENCRYPTION_KEY;
  if (explicit && explicit.length >= 32) {
    return scryptSync(explicit, "whatsarr-settings", 32);
  }

  const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  const keyPath = join(dataDir, "encryption.key");
  if (existsSync(keyPath)) {
    return scryptSync(readFileSync(keyPath, "utf8").trim(), "whatsarr-settings", 32);
  }

  const generated = randomBytes(32).toString("base64url");
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, generated, { encoding: "utf8", mode: 0o600 });
  return scryptSync(generated, "whatsarr-settings", 32);
}
