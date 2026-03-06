import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { PinoLogger } from "nestjs-pino";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters long",
      );
    }
    if (password.length > 128) {
      throw new BadRequestException("Password must not exceed 128 characters");
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      throw new BadRequestException(
        "Password must contain at least one letter and one number",
      );
    }

    const commonPasswords = ["password", "12345678", "qwerty", "abc123"];
    if (commonPasswords.some((weak) => password.toLowerCase().includes(weak))) {
      this.logger.warn("User attempted to use a common weak password");
    }
  }

  private generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString("hex");
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.$transaction(async (tx) => {
      // 1. Создаем только юзера
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      delete user.password;

      const tokens = await this.generateTokens(user.id, user.email, tx);
      return { user, ...tokens };
    });
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const passwordToCompare = user
      ? user.password
      : "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqBWVHxkd0";
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      passwordToCompare,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(user.id, user.email);

    this.logger.info({ userId: user.id, email: user.email }, "User logged in");

    return {
      user: {
        id: user.id,
        name: user.firstName + " " + user.lastName,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Generates access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this.prisma;
    try {
      const payload = { sub: userId, email };

      const accessToken = this.jwtService.sign(payload);

      const refreshToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setSeconds(
        expiresAt.getSeconds() + this.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86400,
      );

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId,
          expiresAt,
        },
      });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (error) {
      this.logger.error(
        {
          error,
          userId,
          email,
        },
        "Failed to generate tokens",
      );
      throw new InternalServerErrorException(
        "Failed to generate authentication tokens",
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto) {
    // Используем транзакцию для атомарности
    const result = await this.prisma.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findUnique({
        where: { token: dto.refreshToken },
        include: {
          user: true, // Нам нужен только юзер, без компаний
        },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException("Invalid or revoked refresh token");
      }

      if (storedToken.expiresAt < new Date()) {
        await tx.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedException("Refresh token has expired");
      }

      const user = storedToken.user;

      // Аннулируем старый токен (Rotation policy)
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return { user };
    });

    const { user } = result;

    // Генерируем новые токены БЕЗ companyId
    // Теперь вызываем так: generateTokens(userId, email)
    const tokens = await this.generateTokens(user.id, user.email);

    this.logger.info({ userId: user.id }, "Access token refreshed");

    return tokens;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    // Validate new password strength
    const sanitizedNewPassword = dto.newPassword.trim();
    this.validatePasswordStrength(sanitizedNewPassword);

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword.trim(),
      user.password,
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn(
        {
          userId,
        },
        "Failed password change attempt - invalid current password",
      );
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Check if new password is the same as current password
    const isSamePassword = await bcrypt.compare(
      sanitizedNewPassword,
      user.password,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        "New password must be different from current password",
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(sanitizedNewPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    // Revoke all refresh tokens for this user (force re-login on all devices)
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.info(
      {
        userId,
      },
      "Password changed successfully",
    );

    return { message: "Password changed successfully" };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const updated = await this.prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        this.logger.warn(
          {
            userId,
            tokenProvided: !!refreshToken,
          },
          "Attempted to logout with invalid or already revoked token",
        );
      }
    } else {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    this.logger.info(
      {
        userId,
        allDevices: !refreshToken,
      },
      "User logged out",
    );

    return { message: "Logged out successfully" };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(
        {
          email: dto.email,
        },
        "Failed to send password reset link - user not found",
      );
      return {
        message:
          "If an account with that email exists, a password reset link has been sent",
      };
    }

    const resetPasswordToken = this.generateSecureToken();
    const resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    this.logger.info(
      {
        userId: user.id,
        email: user.email,
        resetPasswordToken,
      },
      "Password reset link sent",
    );

    return {
      message:
        "If an account with that email exists, a password reset link has been sent",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { resetPasswordToken: dto.token },
    });

    const isExpired = user && user.resetPasswordExpires < new Date();

    if (!user || isExpired) {
      this.logger.warn(
        {
          token: dto.token,
        },
        "Failed to reset password - invalid or expired token",
      );
      throw new UnauthorizedException("Invalid or expired token");
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    this.logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      "Password reset successfully",
    );

    return {
      message: "Password has been reset successfully",
    };
  }
}
