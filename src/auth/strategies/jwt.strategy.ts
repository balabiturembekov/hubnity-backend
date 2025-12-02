import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { PinoLogger } from "nestjs-pino";

interface JwtPayload {
  sub: string;
  email?: string;
  companyId?: string;
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
    // Validate payload structure
    if (!payload || !payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.sub)) {
      throw new UnauthorizedException(
        "Invalid token payload - invalid user ID format",
      );
    }

    // Explicitly check expiration (Passport already checks, but this is for clarity)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Token expired");
    }

    // Require companyId in payload
    if (!payload.companyId) {
      this.logger.warn(
        {
          payloadSub: payload.sub,
        },
        "Token missing companyId",
      );
      throw new UnauthorizedException("Token is invalid - missing companyId");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    // Check if company exists
    if (!user.company) {
      this.logger.warn(
        {
          userId: user.id,
          companyId: user.companyId,
        },
        "User has no associated company",
      );
      throw new UnauthorizedException("User company not found");
    }

    // Verify companyId matches
    if (user.companyId !== payload.companyId) {
      this.logger.warn(
        {
          userId: user.id,
          tokenCompanyId: payload.companyId,
          dbCompanyId: user.companyId,
        },
        "Token companyId mismatch",
      );
      throw new UnauthorizedException(
        "Token is invalid - user company mismatch",
      );
    }

    return user;
  }
}
