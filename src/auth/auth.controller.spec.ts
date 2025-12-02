import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
// User type is not exported from @prisma/client, using any for tests

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    logout: jest.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockUser: any = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("register", () => {
    const registerDto: RegisterDto = {
      name: "John Doe",
      email: "john@example.com",
      companyName: "Test Company",
      password: "password123",
      confirmPassword: "password123",
    };

    const expectedResponse = {
      user: {
        id: "user-id",
        name: "John Doe",
        email: "john@example.com",
        role: "OWNER",
        status: "ACTIVE",
        companyId: "company-id",
        createdAt: new Date(),
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    };

    it("should register a new user", async () => {
      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe("login", () => {
    const loginDto: LoginDto = {
      email: "john@example.com",
      password: "password123",
    };

    const expectedResponse = {
      user: {
        id: "user-id",
        name: "John Doe",
        email: "john@example.com",
        role: "OWNER",
        status: "ACTIVE",
        companyId: "company-id",
        company: {
          id: "company-id",
          name: "Test Company",
        },
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    };

    it("should login user", async () => {
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe("getProfile", () => {
    it("should return current user profile", async () => {
      const result = await controller.getProfile(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe("refreshToken", () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: "valid-refresh-token",
    };

    const expectedResponse = {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
    };

    it("should refresh access token", async () => {
      mockAuthService.refreshToken.mockResolvedValue(expectedResponse);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
    });
  });

  describe("changePassword", () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: "old-password",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    };

    const expectedResponse = {
      message: "Password changed successfully",
    };

    it("should change user password", async () => {
      mockAuthService.changePassword.mockResolvedValue(expectedResponse);

      const result = await controller.changePassword(
        mockUser,
        changePasswordDto,
      );

      expect(result).toEqual(expectedResponse);
      expect(authService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        changePasswordDto,
      );
    });
  });

  describe("forgotPassword", () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      email: "john@example.com",
    };

    const expectedResponse = {
      message:
        "If an account with that email exists, a password reset link has been sent",
    };

    it("should request password reset", async () => {
      mockAuthService.forgotPassword.mockResolvedValue(expectedResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.forgotPassword).toHaveBeenCalledWith(
        forgotPasswordDto,
      );
    });
  });

  describe("resetPassword", () => {
    const resetPasswordDto: ResetPasswordDto = {
      token: "reset-token",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    };

    const expectedResponse = {
      message: "Password has been reset successfully",
    };

    it("should reset password", async () => {
      mockAuthService.resetPassword.mockResolvedValue(expectedResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
    });
  });

  describe("logout", () => {
    const expectedResponse = {
      message: "Logged out successfully",
    };

    it("should logout user without refresh token", async () => {
      mockAuthService.logout.mockResolvedValue(expectedResponse);

      const result = await controller.logout(mockUser);

      expect(result).toEqual(expectedResponse);
      expect(authService.logout).toHaveBeenCalledWith(mockUser.id, undefined);
    });

    it("should logout user with specific refresh token", async () => {
      const body = { refreshToken: "specific-refresh-token" };
      mockAuthService.logout.mockResolvedValue(expectedResponse);

      const result = await controller.logout(mockUser, body);

      expect(result).toEqual(expectedResponse);
      expect(authService.logout).toHaveBeenCalledWith(
        mockUser.id,
        body.refreshToken,
      );
    });
  });
});
