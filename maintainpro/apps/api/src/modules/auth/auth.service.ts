import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import speakeasy from "speakeasy";

import { AppError } from "../../common/errors/AppError";
import { createTokenPair } from "../../common/utils/jwt";
import { comparePassword, hashPassword } from "../../common/utils/passwords";

interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "technician";
  passwordHash: string;
  mfaSecret?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "technician";
}

const usersStore = new Map<string, StoredUser>();

const seedUser: StoredUser = {
  id: "seed-admin",
  email: "admin@maintainpro.local",
  fullName: "MaintainPro Administrator",
  role: "admin",
  passwordHash: bcrypt.hashSync("Admin@1234", 10)
};

usersStore.set(seedUser.email, seedUser);

const toPublicUser = (user: StoredUser): PublicUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role
});

export interface RegisterInput {
  email: string;
  fullName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const existing = usersStore.get(input.email);

    if (existing) {
      throw new AppError("A user with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);

    const created: StoredUser = {
      id: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      role: "technician",
      passwordHash
    };

    usersStore.set(created.email, created);

    const tokenPair = createTokenPair({
      sub: created.id,
      email: created.email,
      role: created.role
    });

    return {
      user: toPublicUser(created),
      ...tokenPair
    };
  },

  async login(input: LoginInput): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const existing = usersStore.get(input.email);

    if (!existing) {
      throw new AppError("Invalid email or password", 401);
    }

    const isValid = await comparePassword(input.password, existing.passwordHash);

    if (!isValid) {
      throw new AppError("Invalid email or password", 401);
    }

    const tokenPair = createTokenPair({
      sub: existing.id,
      email: existing.email,
      role: existing.role
    });

    return {
      user: toPublicUser(existing),
      ...tokenPair
    };
  },

  async setupMfa(email: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const user = usersStore.get(email);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const secret = speakeasy.generateSecret({
      name: `MaintainPro (${email})`
    });

    user.mfaSecret = secret.base32;
    usersStore.set(user.email, user);

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url ?? "");

    return {
      secret: secret.base32,
      qrCodeDataUrl
    };
  },

  verifyMfa(email: string, token: string): boolean {
    const user = usersStore.get(email);

    if (!user?.mfaSecret) {
      throw new AppError("MFA is not configured for this user", 400);
    }

    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token,
      window: 1
    });
  },

  getPublicUsers(): PublicUser[] {
    return Array.from(usersStore.values()).map(toPublicUser);
  },

  getById(id: string): PublicUser | null {
    const found = Array.from(usersStore.values()).find((user) => user.id === id);
    return found ? toPublicUser(found) : null;
  }
};
