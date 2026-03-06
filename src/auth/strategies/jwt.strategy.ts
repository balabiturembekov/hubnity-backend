import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { PinoLogger } from "nestjs-pino";

interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private logger: PinoLogger,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get("JWT_SECRET");
        console.log(
          "🔐 JWT_SECRET used for validation:",
          secret ? "Set" : "NOT SET",
        );
        console.log("🔐 JWT_SECRET length:", secret?.length || 0);
        if (!secret || secret === "secret") {
          logger.warn(
            '⚠️  WARNING: JWT_SECRET is not set or using default "secret". This is insecure in production!',
          );
          if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET must be set in production environment");
          }
        }
        return secret || "secret";
      })(),
    });
    this.logger.setContext(JwtStrategy.name);
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Token expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
