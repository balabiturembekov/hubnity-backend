import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { PinoLogger } from "nestjs-pino";
import * as bcrypt from "bcrypt";

// Mock dependencies
jest.mock("bcrypt");
jest.mock("crypto");

describe("AuthService", () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let logger: PinoLogger;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<PinoLogger>(PinoLogger);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    const registerDto = {
      name: "John Doe",
      email: "john@example.com",
      companyName: "Test Company",
      password: "password123",
      confirmPassword: "password123",
    };

    const mockCompany = {
      id: "company-id",
      name: "Test Company",
      domain: null,
    };

    const mockUser = {
      id: "user-id",
      name: "John Doe",
      email: "john@example.com",
      role: "OWNER",
      status: "ACTIVE",
      avatar: null,
      hourlyRate: null,
      companyId: "company-id",
      createdAt: new Date(),
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findUnique.mockResolvedValue(null);
      mockPrismaService.company.create.mockResolvedValue(mockCompany);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("access-token");
      mockPrismaService.refreshToken.create.mockResolvedValue({});
    });

    it("should successfully register a new user", async () => {
      const { randomBytes } = require("crypto");
      randomBytes.mockReturnValue(Buffer.from("refresh-token-hex", "hex"));

      const result = await service.register(registerDto);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email.toLowerCase() },
      });
      expect(mockPrismaService.company.create).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it("should throw ConflictException if user already exists", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: "existing-user",
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.company.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException if company domain already exists", async () => {
      const dtoWithDomain = { ...registerDto, companyDomain: "example.com" };
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: "existing-company",
      });

      await expect(service.register(dtoWithDomain)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw BadRequestException if passwords do not match", async () => {
      const dtoWithMismatch = {
        ...registerDto,
        confirmPassword: "different-password",
      };

      await expect(service.register(dtoWithMismatch)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if password is too short", async () => {
      const dtoWithShortPassword = {
        ...registerDto,
        password: "short",
        confirmPassword: "short",
      };

      await expect(service.register(dtoWithShortPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if password does not contain letters and numbers", async () => {
      const dtoWithWeakPassword = {
        ...registerDto,
        password: "onlyletters",
        confirmPassword: "onlyletters",
      };

      await expect(service.register(dtoWithWeakPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if email format is invalid", async () => {
      const dtoWithInvalidEmail = { ...registerDto, email: "invalid-email" };

      await expect(service.register(dtoWithInvalidEmail)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should normalize email to lowercase", async () => {
      const { randomBytes } = require("crypto");
      randomBytes.mockReturnValue(Buffer.from("refresh-token-hex", "hex"));

      const dtoWithUpperCaseEmail = {
        ...registerDto,
        email: "JOHN@EXAMPLE.COM",
      };
      await service.register(dtoWithUpperCaseEmail);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: "john@example.com" },
      });
    });
  });

  describe("login", () => {
    const loginDto = {
      email: "john@example.com",
      password: "password123",
    };

    const mockUser = {
      id: "user-id",
      name: "John Doe",
      email: "john@example.com",
      password: "hashed-password",
      role: "OWNER",
      status: "ACTIVE",
      avatar: null,
      hourlyRate: null,
      companyId: "company-id",
      passwordChangedAt: new Date(),
      company: {
        id: "company-id",
        name: "Test Company",
      },
    };

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue("access-token");
      mockPrismaService.refreshToken.create.mockResolvedValue({});
    });

    it("should successfully login with valid credentials", async () => {
      const { randomBytes } = require("crypto");
      randomBytes.mockReturnValue(Buffer.from("refresh-token-hex", "hex"));

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.email).toBe(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
    });

    it("should throw UnauthorizedException with invalid credentials", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user does not exist", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      // Use dummy hash to prevent timing attacks
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user is inactive", async () => {
      const inactiveUser = { ...mockUser, status: "INACTIVE" };
      mockPrismaService.user.findFirst.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw BadRequestException if password is too long", async () => {
      const longPassword = "a".repeat(129);
      const dtoWithLongPassword = { ...loginDto, password: longPassword };

      await expect(service.login(dtoWithLongPassword)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("refreshToken", () => {
    const refreshTokenDto = {
      refreshToken: "valid-refresh-token",
    };

    const mockRefreshToken = {
      id: "token-id",
      token: "valid-refresh-token",
      userId: "user-id",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      revokedAt: null,
      user: {
        id: "user-id",
        email: "john@example.com",
        status: "ACTIVE",
        companyId: "company-id",
        company: {
          id: "company-id",
          name: "Test Company",
        },
      },
    };

    beforeEach(() => {
      mockJwtService.sign.mockReturnValue("new-access-token");
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});
    });

    it("should successfully refresh access token", async () => {
      const { randomBytes } = require("crypto");
      randomBytes.mockReturnValue(Buffer.from("new-refresh-token-hex", "hex"));

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          refreshToken: {
            ...mockPrismaService.refreshToken,
            findUnique: jest.fn().mockResolvedValue(mockRefreshToken),
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException if refresh token is invalid", async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          refreshToken: {
            ...mockPrismaService.refreshToken,
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if refresh token is revoked", async () => {
      const revokedToken = { ...mockRefreshToken, revokedAt: new Date() };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          refreshToken: {
            ...mockPrismaService.refreshToken,
            findUnique: jest.fn().mockResolvedValue(revokedToken),
          },
        });
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if refresh token is expired", async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          refreshToken: {
            ...mockPrismaService.refreshToken,
            findUnique: jest.fn().mockResolvedValue(expiredToken),
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user is inactive", async () => {
      const inactiveUserToken = {
        ...mockRefreshToken,
        user: { ...mockRefreshToken.user, status: "INACTIVE" },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          refreshToken: {
            ...mockPrismaService.refreshToken,
            findUnique: jest.fn().mockResolvedValue(inactiveUserToken),
          },
        });
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("changePassword", () => {
    const userId = "user-id";
    const changePasswordDto = {
      currentPassword: "old-password",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    };

    const mockUser = {
      id: userId,
      email: "john@example.com",
      password: "hashed-old-password",
    };

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-new-password");
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    });

    it("should successfully change password", async () => {
      // First call: verify current password
      // Second call: check if new password is different from current
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // Current password check passes
        .mockResolvedValueOnce(false); // New password is different from current

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result).toEqual({ message: "Password changed successfully" });
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(bcrypt.compare).toHaveBeenNthCalledWith(
        1,
        changePasswordDto.currentPassword,
        mockUser.password,
      );
      expect(bcrypt.compare).toHaveBeenNthCalledWith(
        2,
        changePasswordDto.newPassword,
        mockUser.password,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        12,
      );
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalled();
    });

    it("should throw NotFoundException if user does not exist", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if current password is incorrect", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException if new password is same as current", async () => {
      // First call: verify current password
      // Second call: check if new password is same as current
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // Current password check passes
        .mockResolvedValueOnce(true); // New password equals current password

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(BadRequestException);
      // Should be called twice: once for current password, once to check if new == current
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it("should throw BadRequestException if passwords do not match", async () => {
      const dtoWithMismatch = {
        ...changePasswordDto,
        confirmPassword: "different-password",
      };

      await expect(
        service.changePassword(userId, dtoWithMismatch),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("forgotPassword", () => {
    const forgotPasswordDto = {
      email: "john@example.com",
    };

    const mockUser = {
      id: "user-id",
      email: "john@example.com",
      status: "ACTIVE",
      company: {
        id: "company-id",
        name: "Test Company",
      },
    };

    beforeEach(() => {
      mockConfigService.get.mockReturnValue("http://localhost:3002");
      mockPrismaService.passwordResetToken.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({});
    });

    it("should successfully create reset token for existing user", async () => {
      const { randomBytes } = require("crypto");
      randomBytes.mockReturnValue(Buffer.from("reset-token-hex", "hex"));

      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toContain("password reset link has been sent");
      expect(mockPrismaService.passwordResetToken.create).toHaveBeenCalled();
    });

    it("should return success message even if user does not exist", async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toContain("password reset link has been sent");
      expect(
        mockPrismaService.passwordResetToken.create,
      ).not.toHaveBeenCalled();
    });

    it("should return success message for invalid email format", async () => {
      const dtoWithInvalidEmail = { email: "invalid-email" };

      const result = await service.forgotPassword(dtoWithInvalidEmail);

      expect(result.message).toContain("password reset link has been sent");
    });

    it("should not create token for inactive user", async () => {
      const inactiveUser = { ...mockUser, status: "INACTIVE" };
      mockPrismaService.user.findMany.mockResolvedValue([inactiveUser]);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toContain("password reset link has been sent");
      expect(
        mockPrismaService.passwordResetToken.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    const resetPasswordDto = {
      token: "valid-reset-token",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    };

    const mockResetToken = {
      id: "token-id",
      token: "valid-reset-token",
      userId: "user-id",
      email: "john@example.com",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      usedAt: null,
      user: {
        id: "user-id",
        email: "john@example.com",
        password: "old-hashed-password",
        status: "ACTIVE",
      },
    };

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // New password is different
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-new-password");
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.passwordResetToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    });

    it("should successfully reset password", async () => {
      mockPrismaService.$transaction
        .mockImplementationOnce(async (callback) => {
          // First transaction: validate token
          return callback({
            ...mockPrismaService,
            passwordResetToken: {
              ...mockPrismaService.passwordResetToken,
              findUnique: jest.fn().mockResolvedValue(mockResetToken),
            },
          });
        })
        .mockImplementationOnce(async (callback) => {
          // Second transaction: update password
          return callback({
            ...mockPrismaService,
            user: {
              ...mockPrismaService.user,
              update: jest.fn().mockResolvedValue({}),
            },
            passwordResetToken: {
              ...mockPrismaService.passwordResetToken,
              update: jest.fn().mockResolvedValue({}),
            },
            refreshToken: {
              ...mockPrismaService.refreshToken,
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          });
        });

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toEqual({
        message: "Password has been reset successfully",
      });
    });

    it("should throw UnauthorizedException if token is invalid", async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          passwordResetToken: {
            ...mockPrismaService.passwordResetToken,
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw BadRequestException if token is already used", async () => {
      const usedToken = { ...mockResetToken, usedAt: new Date() };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          passwordResetToken: {
            ...mockPrismaService.passwordResetToken,
            findUnique: jest.fn().mockResolvedValue(usedToken),
          },
        });
      });

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw UnauthorizedException if token is expired", async () => {
      const expiredToken = {
        ...mockResetToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          passwordResetToken: {
            ...mockPrismaService.passwordResetToken,
            findUnique: jest.fn().mockResolvedValue(expiredToken),
          },
        });
      });

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw BadRequestException if new password is same as current", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // New password is same as current

      mockPrismaService.$transaction.mockImplementationOnce(
        async (callback) => {
          return callback({
            ...mockPrismaService,
            passwordResetToken: {
              ...mockPrismaService.passwordResetToken,
              findUnique: jest.fn().mockResolvedValue(mockResetToken),
            },
          });
        },
      );

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("logout", () => {
    const userId = "user-id";

    beforeEach(() => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    });

    it("should successfully logout and revoke all tokens", async () => {
      const result = await service.logout(userId);

      expect(result).toEqual({ message: "Logged out successfully" });
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should successfully logout and revoke specific token", async () => {
      const refreshToken = "specific-refresh-token";
      const result = await service.logout(userId, refreshToken);

      expect(result).toEqual({ message: "Logged out successfully" });
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          token: refreshToken,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should return success even if token does not exist", async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.logout(userId, "non-existent-token");

      expect(result).toEqual({ message: "Logged out successfully" });
    });
  });

  describe("validateUser", () => {
    const userId = "123e4567-e89b-12d3-a456-426614174000"; // Valid UUID format
    const mockUserWithCompany = {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      role: "OWNER",
      status: "ACTIVE",
      avatar: null,
      hourlyRate: null,
      companyId: "company-id",
      company: {
        id: "company-id",
        name: "Test Company",
      },
    };

    it("should return user if valid", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithCompany);

      const result = await service.validateUser(userId);

      expect(result).toEqual(mockUserWithCompany);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: expect.any(Object),
      });
    });

    it("should return null if user does not exist", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(userId);

      expect(result).toBeNull();
    });

    it("should return null if userId is empty", async () => {
      const result = await service.validateUser("");

      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it("should return null if userId format is invalid", async () => {
      const result = await service.validateUser("invalid-uuid-format");

      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
