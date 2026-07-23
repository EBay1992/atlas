import type { Clock, IdGenerator, PasswordHasher, TokenService } from "@atlas/domain";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  async sign(claims: {
    sub: string;
    tenantId: string;
    email: string;
    role: string;
  }): Promise<string> {
    return jwt.sign(
      {
        tenantId: claims.tenantId,
        email: claims.email,
        role: claims.role,
      },
      this.secret,
      {
        subject: claims.sub,
        expiresIn: this.expiresIn as jwt.SignOptions["expiresIn"],
      },
    );
  }

  async verify(token: string): Promise<{
    sub: string;
    tenantId: string;
    email: string;
    role: string;
  }> {
    const payload = jwt.verify(token, this.secret) as jwt.JwtPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new Error("Invalid token claims");
    }
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
    };
  }
}
