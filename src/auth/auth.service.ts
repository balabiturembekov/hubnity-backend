import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { PinoLogger } from "nestjs-pino";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;
  private readonly PASSWORD_RESET_TOKEN_EXPIRES_IN_HOURS = 1;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  onModuleInit() {
    // Clean up expired tokens on startup
    this.cleanupExpiredTokens().catch((err) => {
      this.logger.error({ err }, "Failed to cleanup expired tokens on startup");
    });
  }

  /**
   * Clean up expired tokens daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleTokenCleanup() {
    await this.cleanupExpiredTokens();
  }

  /**
   * Validates password strength
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters long",
      );
    }
    if (password.length > 128) {
      throw new BadRequestException("Password must not exceed 128 characters");
    }

    // Check password complexity
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      throw new BadRequestException(
        "Password must contain at least one letter and one number",
      );
    }

    // Optional: Check for common weak passwords
    const commonPasswords = ["password", "12345678", "qwerty", "abc123"];
    if (commonPasswords.some((weak) => password.toLowerCase().includes(weak))) {
      this.logger.warn("User attempted to use a common weak password");
    }
  }

  /**
   * Generates a secure random token
   */
  private generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString("hex");
  }

  async register(dto: RegisterDto) {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate email is not empty after normalization
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new BadRequestException("Email is required");
    }

    // Additional email format validation (DTO already has @IsEmail, but double-check for security)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new BadRequestException("Invalid email format");
    }

    // Validate and sanitize name
    const sanitizedName = dto.name.trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      throw new BadRequestException("Name must be at least 2 characters long");
    }

    // Validate and sanitize company name
    const sanitizedCompanyName = dto.companyName.trim();
    if (!sanitizedCompanyName || sanitizedCompanyName.length < 2) {
      throw new BadRequestException(
        "Company name must be at least 2 characters long",
      );
    }

    // Validate password strength
    const sanitizedPassword = dto.password.trim();
    this.validatePasswordStrength(sanitizedPassword);

    // Validate confirm password
    if (!dto.confirmPassword) {
      throw new BadRequestException("Confirm password is required");
    }
    const sanitizedConfirmPassword = dto.confirmPassword.trim();
    if (sanitizedPassword !== sanitizedConfirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }

    // Validate and normalize companyDomain
    let normalizedDomain: string | null = null;
    if (dto.companyDomain && dto.companyDomain.trim() !== "") {
      const trimmedDomain = dto.companyDomain.trim().toLowerCase();
      const domainRegex =
        /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(trimmedDomain)) {
        throw new BadRequestException(
          "Invalid domain format. Domain must be a valid domain name (e.g., example.com)",
        );
      }
      normalizedDomain = trimmedDomain;
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException("Hourly rate cannot be negative");
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException(
          "Hourly rate cannot exceed $10,000 per hour",
        );
      }
    }

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 12); // Increased salt rounds from 10 to 12 for better security
    const userRole = dto.role === "SUPER_ADMIN" ? "OWNER" : dto.role || "OWNER";

    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException("User with this email already exists");
      }

      if (normalizedDomain) {
        const existingCompany = await tx.company.findUnique({
          where: { domain: normalizedDomain },
        });

        if (existingCompany) {
          throw new ConflictException(
            "Company with this domain already exists",
          );
        }
      }

      const company = await tx.company.create({
        data: {
          name: sanitizedCompanyName,
          domain: normalizedDomain,
        },
      });

      const user = await tx.user.create({
        data: {
          name: sanitizedName,
          email: normalizedEmail,
          password: hashedPassword,
          role: userRole,
          avatar: dto.avatar,
          hourlyRate: dto.hourlyRate,
          companyId: company.id,
          passwordChangedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatar: true,
          hourlyRate: true,
          companyId: true,
          createdAt: true,
        },
      });

      return { user, company };
    });

    const { user, company } = result;

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, company.id);

    this.logger.info(
      {
        userId: user.id,
        email: user.email,
        companyId: company.id,
      },
      "User successfully registered",
    );

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate email is not empty after normalization
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new BadRequestException("Email is required");
    }

    // Validate password is not empty
    const sanitizedPassword = dto.password.trim();
    if (!sanitizedPassword || sanitizedPassword.length === 0) {
      throw new BadRequestException("Password is required");
    }

    // Check password length to prevent DoS
    if (sanitizedPassword.length > 128) {
      throw new BadRequestException("Password must not exceed 128 characters");
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        passwordChangedAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await bcrypt.compare(sanitizedPassword, user.password);
    } else {
      // Use a valid bcrypt hash to prevent timing attacks
      // This is a valid bcrypt hash with cost factor 12
      const dummyHash =
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqBWVHxkd0";
      await bcrypt.compare(sanitizedPassword, dummyHash);
    }

    if (!user || !isPasswordValid) {
      this.logger.warn(
        {
          email: normalizedEmail,
          hasUser: !!user,
          isPasswordValid,
        },
        "Failed login attempt",
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is inactive");
    }

    // Check if company exists
    if (!user.company || !user.company.id) {
      throw new UnauthorizedException("User company not found");
    }

    // Check if password needs to be changed (e.g., older than 90 days)
    const PASSWORD_MAX_AGE_DAYS = 90;
    if (user.passwordChangedAt) {
      const daysSincePasswordChange = Math.floor(
        (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSincePasswordChange > PASSWORD_MAX_AGE_DAYS) {
        this.logger.warn(
          {
            userId: user.id,
            daysSincePasswordChange,
          },
          "User password is outdated",
        );
        // Note: In production, you might want to return a flag indicating password needs change
        // For now, we just log it
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.companyId,
    );

    this.logger.info(
      {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
      },
      "User successfully logged in",
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        hourlyRate: user.hourlyRate,
        companyId: user.companyId,
        company: {
          id: user.company.id,
          name: user.company.name,
        },
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
    companyId: string,
  ) {
    try {
      const payload = {
        sub: userId,
        email,
        companyId,
      };

      const accessToken = this.jwtService.sign(payload);

      // Generate refresh token
      const refreshToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_IN_DAYS,
      );

      // Store refresh token in database
      await this.prisma.refreshToken.create({
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
          companyId,
        },
        "Failed to generate tokens",
      );
      throw new BadRequestException("Failed to generate authentication tokens");
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto) {
    // Use transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      const refreshToken = await tx.refreshToken.findUnique({
        where: { token: dto.refreshToken },
        include: { user: { include: { company: true } } },
      });

      if (!refreshToken) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      if (refreshToken.revokedAt) {
        throw new UnauthorizedException("Refresh token has been revoked");
      }

      if (refreshToken.expiresAt < new Date()) {
        // Clean up expired token
        await tx.refreshToken.delete({
          where: { id: refreshToken.id },
        });
        throw new UnauthorizedException("Refresh token has expired");
      }

      const user = refreshToken.user;

      if (user.status !== "ACTIVE") {
        throw new UnauthorizedException("User account is inactive");
      }

      if (!user.company) {
        throw new UnauthorizedException("User company not found");
      }

      // Revoke old refresh token first (before generating new ones)
      await tx.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });

      return { user };
    });

    const { user } = result;

    // Generate new tokens after old token is revoked
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.companyId,
    );

    this.logger.info(
      {
        userId: user.id,
      },
      "Access token refreshed",
    );

    return tokens;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    // Validate new password strength
    const sanitizedNewPassword = dto.newPassword.trim();
    this.validatePasswordStrength(sanitizedNewPassword);

    // Validate confirm password
    if (sanitizedNewPassword !== dto.confirmPassword.trim()) {
      throw new BadRequestException(
        "New password and confirm password do not match",
      );
    }

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
        passwordChangedAt: new Date(),
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
   * Request password reset (forgot password)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      // Still return success to prevent email enumeration
      return {
        message:
          "If an account with that email exists, a password reset link has been sent",
      };
    }

    // Find user by email (search across all companies)
    // Note: Email is unique per company, so we might find multiple users
    // We'll send reset token to the first active user found
    const users = await this.prisma.user.findMany({
      where: { email: normalizedEmail },
      include: { company: true },
      orderBy: { createdAt: "desc" }, // Get most recent user first
    });

    // Find first active user
    const user = users.find((u) => u.status === "ACTIVE");

    // Always return success to prevent email enumeration
    // But only create token if user exists
    if (user) {
      // Generate reset token
      const resetToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(
        expiresAt.getHours() + this.PASSWORD_RESET_TOKEN_EXPIRES_IN_HOURS,
      );

      // Delete any existing unused tokens for this user
      await this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      // Create new reset token
      await this.prisma.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          email: normalizedEmail,
          expiresAt,
        },
      });

      // In production, send email here
      // For now, log the token (only in development)
      if (process.env.NODE_ENV !== "production") {
        const resetUrl = `${this.configService.get("FRONTEND_URL") || "http://localhost:3002"}/reset-password?token=${resetToken}`;
        this.logger.info(
          {
            email: normalizedEmail,
            resetToken,
            resetUrl,
          },
          "Password reset token generated (DEV MODE - token logged)",
        );
      } else {
        // TODO: Send email with reset link
        this.logger.info(
          {
            email: normalizedEmail,
            userId: user.id,
          },
          "Password reset token generated (email should be sent)",
        );
      }
    } else {
      // Log attempt even if user doesn't exist (for security monitoring)
      this.logger.warn(
        {
          email: normalizedEmail,
          userExists: !!user,
          userStatus: user?.status,
        },
        "Password reset requested for non-existent or inactive user",
      );
    }

    // Always return success message
    return {
      message:
        "If an account with that email exists, a password reset link has been sent",
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(dto: ResetPasswordDto) {
    // Validate new password strength
    const sanitizedNewPassword = dto.newPassword.trim();
    this.validatePasswordStrength(sanitizedNewPassword);

    // Validate confirm password
    if (sanitizedNewPassword !== dto.confirmPassword.trim()) {
      throw new BadRequestException(
        "New password and confirm password do not match",
      );
    }

    // Find reset token and validate in transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { token: dto.token },
        include: { user: true },
      });

      if (!resetToken) {
        throw new UnauthorizedException("Invalid or expired reset token");
      }

      if (resetToken.usedAt) {
        throw new BadRequestException("Reset token has already been used");
      }

      if (resetToken.expiresAt < new Date()) {
        throw new UnauthorizedException("Reset token has expired");
      }

      const user = resetToken.user;

      if (user.status !== "ACTIVE") {
        throw new UnauthorizedException("User account is inactive");
      }

      return { resetToken, user };
    });

    const { resetToken, user } = result;

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

    // Update password and mark token as used in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Revoke all refresh tokens for this user
      await tx.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    this.logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      "Password reset successfully",
    );

    return { message: "Password has been reset successfully" };
  }

  /**
   * Logout by refresh token (without access token)
   * Useful when access token expired but refresh token is still valid
   */
  async logoutByRefreshToken(refreshToken: string) {
    // Validate input
    if (
      !refreshToken ||
      typeof refreshToken !== "string" ||
      refreshToken.trim() === ""
    ) {
      throw new UnauthorizedException("Refresh token is required");
    }

    // Find refresh token to get userId
    const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!refreshTokenRecord) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (refreshTokenRecord.revokedAt) {
      throw new UnauthorizedException("Refresh token has already been revoked");
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token has expired");
    }

    // Check user status
    if (
      !refreshTokenRecord.user ||
      refreshTokenRecord.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("User account is inactive");
    }

    // Revoke the refresh token
    return this.logout(refreshTokenRecord.userId, refreshToken);
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Revoke specific refresh token (verify it belongs to the user)
      const updated = await this.prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          userId, // This ensures the token belongs to the user
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        // Token doesn't exist or already revoked or doesn't belong to user
        this.logger.warn(
          {
            userId,
            tokenProvided: !!refreshToken,
          },
          "Attempted to logout with invalid or already revoked token",
        );
        // Still return success to prevent token enumeration
      }
    } else {
      // Revoke all refresh tokens for this user
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

  /**
   * Clean up expired tokens (should be called periodically)
   */
  async cleanupExpiredTokens() {
    const now = new Date();
    const OLD_REVOKED_TOKENS_DAYS = 7; // Delete revoked tokens older than 7 days
    const oldRevokedDate = new Date();
    oldRevokedDate.setDate(oldRevokedDate.getDate() - OLD_REVOKED_TOKENS_DAYS);

    // Delete expired refresh tokens
    const deletedExpiredRefreshTokens =
      await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

    // Delete old revoked refresh tokens (older than 7 days)
    const deletedOldRevokedRefreshTokens =
      await this.prisma.refreshToken.deleteMany({
        where: {
          revokedAt: {
            not: null,
            lt: oldRevokedDate,
          },
        },
      });

    // Delete expired password reset tokens
    const deletedExpiredResetTokens =
      await this.prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

    // Delete old used password reset tokens (older than 7 days)
    const deletedOldUsedResetTokens =
      await this.prisma.passwordResetToken.deleteMany({
        where: {
          usedAt: {
            not: null,
            lt: oldRevokedDate,
          },
        },
      });

    this.logger.info(
      {
        deletedExpiredRefreshTokens: deletedExpiredRefreshTokens.count,
        deletedOldRevokedRefreshTokens: deletedOldRevokedRefreshTokens.count,
        deletedExpiredResetTokens: deletedExpiredResetTokens.count,
        deletedOldUsedResetTokens: deletedOldUsedResetTokens.count,
      },
      "Cleaned up expired and old tokens",
    );

    return {
      deletedExpiredRefreshTokens: deletedExpiredRefreshTokens.count,
      deletedOldRevokedRefreshTokens: deletedOldRevokedRefreshTokens.count,
      deletedExpiredResetTokens: deletedExpiredResetTokens.count,
      deletedOldUsedResetTokens: deletedOldUsedResetTokens.count,
    };
  }

  async validateUser(userId: string) {
    if (!userId) {
      return null;
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      this.logger.warn(
        {
          userId,
        },
        "Invalid user ID format in validateUser",
      );
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
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

    // Check if company exists (may be null if company was deleted)
    if (user && !user.company) {
      this.logger.warn(
        {
          userId: user.id,
          companyId: user.companyId,
        },
        "User has no associated company",
      );
    }

    return user; // May be null - this is expected behavior
  }
}
