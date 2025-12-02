import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtStrategy } from "./jwt.strategy";
import { PinoLogger } from "nestjs-pino";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue("test-secret"),
  };

  const mockLogger = {
    setContext: jest.fn(),
    warn: jest.fn(),
  };

  const mockUser = {
    id: "123e4567-e89b-12d3-a456-426614174000", // Valid UUID format
    email: "john@example.com",
    name: "John Doe",
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  describe("validate", () => {
    const validPayload = {
      sub: "123e4567-e89b-12d3-a456-426614174000", // Valid UUID format
      email: "john@example.com",
      companyId: "company-id",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("should return user if payload is valid", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: validPayload.sub },
        select: expect.any(Object),
      });
    });

    it("should throw UnauthorizedException if payload is missing", async () => {
      await expect(strategy.validate(null as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if sub is missing", async () => {
      const invalidPayload = { ...validPayload, sub: undefined };

      await expect(strategy.validate(invalidPayload as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user ID format is invalid", async () => {
      const invalidPayload = {
        ...validPayload,
        sub: "invalid-uuid-format-not-valid",
      };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if token is expired", async () => {
      const expiredPayload = {
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) - 3600,
      };

      await expect(strategy.validate(expiredPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if companyId is missing", async () => {
      const payloadWithoutCompany = { ...validPayload, companyId: undefined };

      await expect(
        strategy.validate(payloadWithoutCompany as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if user does not exist", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user is inactive", async () => {
      const inactiveUser = { ...mockUser, status: "INACTIVE" };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user has no company", async () => {
      const userWithoutCompany = { ...mockUser, company: null };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutCompany);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if companyId mismatch", async () => {
      const payloadWithDifferentCompany = {
        ...validPayload,
        companyId: "different-company-id",
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        strategy.validate(payloadWithDifferentCompany),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
