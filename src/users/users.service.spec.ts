import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { UsersService } from "./users.service";
import { UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("UsersService", () => {
  let service: UsersService;
  let prismaService: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidateUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const companyId = "company-id";
    const createUserDto = {
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    };

    const mockUser = {
      id: "user-id",
      name: "John Doe",
      email: "john@example.com",
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      avatar: null,
      hourlyRate: null,
      companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
    });

    it("should successfully create a user", async () => {
      const result = await service.create(
        createUserDto,
        companyId,
        UserRole.OWNER,
      );

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: createUserDto.email.toLowerCase(),
          companyId,
        },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(
        createUserDto.password.trim(),
        12,
      );
    });

    it("should throw ConflictException if user already exists", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: "existing-user",
      });

      await expect(
        service.create(createUserDto, companyId, UserRole.OWNER),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ForbiddenException if trying to create OWNER without SUPER_ADMIN role", async () => {
      const dtoWithOwner = { ...createUserDto, role: UserRole.OWNER };

      await expect(
        service.create(dtoWithOwner, companyId, UserRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if trying to create SUPER_ADMIN without SUPER_ADMIN role", async () => {
      const dtoWithSuperAdmin = {
        ...createUserDto,
        role: UserRole.SUPER_ADMIN,
      };

      await expect(
        service.create(dtoWithSuperAdmin, companyId, UserRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if password is too short", async () => {
      const dtoWithShortPassword = { ...createUserDto, password: "short" };

      await expect(
        service.create(dtoWithShortPassword, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if password does not contain letters and numbers", async () => {
      const dtoWithWeakPassword = { ...createUserDto, password: "onlyletters" };

      await expect(
        service.create(dtoWithWeakPassword, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if email format is invalid", async () => {
      const dtoWithInvalidEmail = { ...createUserDto, email: "invalid-email" };

      await expect(
        service.create(dtoWithInvalidEmail, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if name is too short", async () => {
      const dtoWithShortName = { ...createUserDto, name: "A" };

      await expect(
        service.create(dtoWithShortName, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if name exceeds 255 characters", async () => {
      const dtoWithLongName = { ...createUserDto, name: "A".repeat(256) };

      await expect(
        service.create(dtoWithLongName, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if avatar URL is invalid", async () => {
      const dtoWithInvalidAvatar = { ...createUserDto, avatar: "not-a-url" };

      await expect(
        service.create(dtoWithInvalidAvatar, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if hourly rate is negative", async () => {
      const dtoWithNegativeRate = { ...createUserDto, hourlyRate: -10 };

      await expect(
        service.create(dtoWithNegativeRate, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if hourly rate exceeds 10000", async () => {
      const dtoWithHighRate = { ...createUserDto, hourlyRate: 10001 };

      await expect(
        service.create(dtoWithHighRate, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    const companyId = "company-id";
    const mockUsers = [
      {
        id: "user-1",
        name: "User 1",
        email: "user1@example.com",
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId,
      },
      {
        id: "user-2",
        name: "User 2",
        email: "user2@example.com",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        companyId,
      },
    ];

    it("should return cached users if available", async () => {
      const cacheKey = `users:${companyId}:all`;
      mockCacheService.get.mockResolvedValue(mockUsers);

      const result = await service.findAll(companyId);

      expect(result).toEqual(mockUsers);
      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(mockPrismaService.user.findMany).not.toHaveBeenCalled();
    });

    it("should fetch and cache users if not in cache", async () => {
      const cacheKey = `users:${companyId}:all`;
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll(companyId);

      expect(result).toEqual(mockUsers);
      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { companyId },
        select: expect.any(Object),
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        mockUsers,
        300,
      );
    });
  });

  describe("findOne", () => {
    const userId = "user-id";
    const companyId = "company-id";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId,
    };

    it("should return user if found", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne(userId, companyId);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, companyId },
        select: expect.any(Object),
      });
    });

    it("should throw NotFoundException if user not found", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    const userId = "user-id";
    const companyId = "company-id";
    const updateUserDto = {
      name: "Updated Name",
    };

    const mockCurrentUser = {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      password: "hashed-password",
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId,
    };

    const mockUpdatedUser = {
      ...mockCurrentUser,
      name: "Updated Name",
    };

    beforeEach(() => {
      // Mock findOne (called at the start of update)
      jest.spyOn(service, "findOne").mockResolvedValue(mockCurrentUser as any);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          user: {
            ...mockPrismaService.user,
            findFirst: jest.fn().mockResolvedValue(mockCurrentUser),
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
          timeEntry: {
            ...mockPrismaService.timeEntry,
            findMany: jest.fn().mockResolvedValue([]),
          },
        });
      });
    });

    it("should successfully update user", async () => {
      let updateCalled = false;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          ...mockPrismaService,
          user: {
            ...mockPrismaService.user,
            findFirst: jest.fn().mockResolvedValue(mockCurrentUser),
            update: jest.fn().mockImplementation(() => {
              updateCalled = true;
              return Promise.resolve(mockUpdatedUser);
            }),
          },
          timeEntry: {
            ...mockPrismaService.timeEntry,
            findMany: jest.fn().mockResolvedValue([]),
          },
        });
      });

      const result = await service.update(
        userId,
        updateUserDto,
        companyId,
        UserRole.OWNER,
      );

      expect(result).toEqual(mockUpdatedUser);
      expect(updateCalled).toBe(true);
    });

    it("should throw NotFoundException if user not found", async () => {
      jest
        .spyOn(service, "findOne")
        .mockRejectedValue(new NotFoundException("User not found"));

      await expect(
        service.update(userId, updateUserDto, companyId, UserRole.OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if trying to change role to OWNER without SUPER_ADMIN", async () => {
      const dtoWithOwner = { ...updateUserDto, role: UserRole.OWNER };

      await expect(
        service.update(userId, dtoWithOwner, companyId, UserRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if trying to deactivate self", async () => {
      const dtoWithInactive = { ...updateUserDto, status: UserStatus.INACTIVE };

      await expect(
        service.update(
          userId,
          dtoWithInactive,
          companyId,
          UserRole.EMPLOYEE,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if new password is same as current", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const dtoWithPassword = { ...updateUserDto, password: "newpassword123" };

      await expect(
        service.update(userId, dtoWithPassword, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ConflictException if email already exists", async () => {
      const dtoWithEmail = { ...updateUserDto, email: "existing@example.com" };

      mockPrismaService.$transaction.mockImplementationOnce(
        async (callback) => {
          return callback({
            ...mockPrismaService,
            user: {
              ...mockPrismaService.user,
              findFirst: jest
                .fn()
                .mockResolvedValueOnce(mockCurrentUser) // For transaction check
                .mockResolvedValueOnce({ id: "other-user" }), // For email check
            },
            timeEntry: {
              ...mockPrismaService.timeEntry,
              findMany: jest.fn().mockResolvedValue([]),
            },
          });
        },
      );

      await expect(
        service.update(userId, dtoWithEmail, companyId, UserRole.OWNER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    const userId = "user-id";
    const companyId = "company-id";

    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      companyId,
    };

    beforeEach(() => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);
    });

    it("should successfully delete user", async () => {
      const result = await service.remove(userId, companyId, UserRole.OWNER);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it("should throw BadRequestException if trying to delete self", async () => {
      await expect(
        service.remove(userId, companyId, UserRole.OWNER, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ForbiddenException if trying to delete OWNER without SUPER_ADMIN", async () => {
      const ownerUser = { ...mockUser, role: UserRole.OWNER };
      mockPrismaService.user.findFirst.mockResolvedValueOnce(ownerUser); // For findOne
      mockPrismaService.user.findFirst.mockResolvedValueOnce(ownerUser); // For transaction

      await expect(
        service.remove(userId, companyId, UserRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if user has active time entries", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        { id: "entry-1" },
      ]);

      await expect(
        service.remove(userId, companyId, UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
