import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import bcrypt from "bcryptjs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SESSION_COOKIE = "whatsarr_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  get cookieName() {
    return SESSION_COOKIE;
  }

  isAuthDisabled() {
    return process.env.AUTH_DISABLED !== "false";
  }

  async isSetupComplete() {
    if (this.isAuthDisabled()) {
      return true;
    }

    const count = await this.prisma.adminCredential.count();
    return count > 0;
  }

  async setup(password: string) {
    if (await this.isSetupComplete()) {
      throw new ConflictException("L'administrateur existe deja.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.adminCredential.create({
      data: {
        id: "admin",
        passwordHash
      }
    });

    return this.createSession();
  }

  async login(password: string) {
    const admin = await this.prisma.adminCredential.findUnique({
      where: { id: "admin" }
    });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException("Mot de passe incorrect.");
    }

    return this.createSession();
  }

  verifySession(token: string | undefined) {
    if (!token) {
      return false;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    const [encodedPayload, expiresAt, signature] = parts;
    const expiresAtNumber = Number(expiresAt);
    if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Date.now()) {
      return false;
    }

    const expected = this.sign(`${encodedPayload}.${expiresAt}`);
    return safeEqual(signature, expected);
  }

  createSession() {
    const payload = randomBytes(24).toString("base64url");
    const expiresAt = String(Date.now() + SESSION_TTL_MS);
    return `${payload}.${expiresAt}.${this.sign(`${payload}.${expiresAt}`)}`;
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: SESSION_TTL_MS
    };
  }

  private sign(value: string) {
    return createHmac("sha256", getSessionSecret())
      .update(value)
      .digest("base64url");
  }
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return (
    aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
  );
}

function getSessionSecret() {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 32) {
    return explicit;
  }

  const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  const secretPath = join(dataDir, "admin-session.secret");
  if (existsSync(secretPath)) {
    return readFileSync(secretPath, "utf8").trim();
  }

  const generated = randomBytes(32).toString("base64url");
  mkdirSync(dirname(secretPath), { recursive: true });
  writeFileSync(secretPath, generated, { encoding: "utf8", mode: 0o600 });
  return generated;
}
