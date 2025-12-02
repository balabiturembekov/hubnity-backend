import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserRole, UserStatus } from "@prisma/client";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser = {
    id: "user-id",
    name: "John Doe",
    email: "john@example.com",
    role: UserRole.EMPLOYEE,
    status: UserStatus.ACTIVE,
    avatar: null,
    hourlyRate: null,
    companyId: "company-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOwner = {
    ...mockUser,
    role: UserRole.OWNER,
  };

  const mockAdmin = {
    ...mockUser,
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    const createUserDto: CreateUserDto = {
      name: "New User",
      email: "newuser@example.com",
      password: "password123",
    };

    it("should create a user", async () => {
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto, mockOwner);

      expect(result).toEqual(mockUser);
      expect(usersService.create).toHaveBeenCalledWith(
        createUserDto,
        mockOwner.companyId,
        mockOwner.role,
      );
    });
  });

  describe("findAll", () => {
    const mockUsers = [mockUser, mockAdmin];

    it("should return all users", async () => {
      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll(mockOwner);

      expect(result).toEqual(mockUsers);
      expect(usersService.findAll).toHaveBeenCalledWith(mockOwner.companyId);
    });
  });

  describe("getMyProfile", () => {
    it("should return current user profile", async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getMyProfile(mockUser);

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
      );
    });
  });

  describe("updateMyProfile", () => {
    const updateUserDto: UpdateUserDto = {
      name: "Updated Name",
    };

    it("should update current user profile", async () => {
      const updatedUser = { ...mockUser, name: "Updated Name" };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateMyProfile(mockUser, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        updateUserDto,
        mockUser.companyId,
        mockUser.role,
      );
    });

    it("should remove role from update if user tries to change it", async () => {
      const updateWithRole = { ...updateUserDto, role: UserRole.ADMIN };
      const updatedUser = { ...mockUser, name: "Updated Name" };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateMyProfile(mockUser, updateWithRole);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.not.objectContaining({ role: UserRole.ADMIN }),
        mockUser.companyId,
        mockUser.role,
      );
    });
  });

  describe("findOne", () => {
    it("should return user if owner", async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(mockUser.id, mockOwner);

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        mockOwner.companyId,
      );
    });

    it("should return user if admin", async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(mockUser.id, mockAdmin);

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        mockAdmin.companyId,
      );
    });

    it("should return user if employee viewing own profile", async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(mockUser.id, mockUser);

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
      );
    });

    it("should throw ForbiddenException if employee tries to view other profile", () => {
      const otherUserId = "other-user-id";
      const employeeUser = {
        id: "employee-id",
        name: "Employee",
        email: "employee@example.com",
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId: "company-id",
      };

      expect(() => controller.findOne(otherUserId, employeeUser)).toThrow(
        ForbiddenException,
      );
      expect(usersService.findOne).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const updateUserDto: UpdateUserDto = {
      name: "Updated Name",
    };

    it("should update user", async () => {
      const updatedUser = { ...mockUser, name: "Updated Name" };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(
        mockUser.id,
        updateUserDto,
        mockOwner,
      );

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        updateUserDto,
        mockOwner.companyId,
        mockOwner.role,
        mockOwner.id,
      );
    });
  });

  describe("remove", () => {
    it("should delete user", async () => {
      mockUsersService.remove.mockResolvedValue(mockUser);

      const result = await controller.remove(mockUser.id, mockOwner);

      expect(result).toEqual(mockUser);
      expect(usersService.remove).toHaveBeenCalledWith(
        mockUser.id,
        mockOwner.companyId,
        mockOwner.role,
        mockOwner.id,
      );
    });
  });
});
