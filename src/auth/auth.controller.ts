import { ICurrentUser } from "@/users/user-interface";
import { UsersService } from "@/users/users.service";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { GetUser } from "./decorators/get-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { TokensResponseDto } from "./dto/tokens-response.dto";
import { ApiAuth } from "./decorators/api-auth.decorator";
import { MessageResponseDto } from "@/common/dto/message-response.dto";

// Helper to get throttle limit based on environment
const getThrottleLimit = (prodLimit: number, devLimit: number = 100) => {
  return process.env.NODE_ENV === "production" ? prodLimit : devLimit;
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: getThrottleLimit(3, 100), ttl: 60000 } })
  @ApiOperation({
    summary: "Register a new user",
    description: "Registers a new user and returns a JWT token.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "Пользователь успешно создан",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  @ApiResponse({ status: 409, description: "User already exists" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(5, 100), ttl: 60000 } })
  @ApiOperation({
    summary: "Login a user",
    description: "Authenticates a user and returns a JWT token.",
  })
  @ApiResponse({
    status: 200,
    description: "Successful login",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current user",
    description:
      "Returns full information about the current user. Recommended to use GET /users/me for consistency.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getProfile(@GetUser() user: ICurrentUser) {
    return this.usersService.findOne(user.id);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(10, 200), ttl: 60000 } })
  @ApiOperation({
    summary: "Refresh access token",
    description:
      "Refreshes access token using refresh token. Returns a new pair of tokens.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Successfully refreshed tokens",
    type: TokensResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired refresh token",
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post("change-password")
  @ApiAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(5, 100), ttl: 60000 } })
  @ApiOperation({
    summary: "Change password",
    description:
      "Changes the password of the current user. Requires the current password for confirmation.",
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password changed successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  @ApiResponse({ status: 401, description: "Invalid current password" })
  async changePassword(
    @GetUser() user: ICurrentUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  // @Post("forgot-password")
  // @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { limit: getThrottleLimit(3, 50), ttl: 60000 } })
  // @ApiOperation({
  //   summary: "Запросить восстановление пароля",
  //   description:
  //     "Отправляет email с токеном для восстановления пароля. Всегда возвращает успех для предотвращения перечисления email.",
  // })
  // @ApiBody({ type: ForgotPasswordDto })
  // @ApiResponse({
  //   status: 200,
  //   description: "Если аккаунт существует, письмо с инструкциями отправлено",
  //   schema: {
  //     type: "object",
  //     properties: {
  //       message: {
  //         type: "string",
  //         example:
  //           "If an account with that email exists, a password reset link has been sent",
  //       },
  //     },
  //   },
  // })
  // async forgotPassword(@Body() dto: ForgotPasswordDto) {
  //   return this.authService.forgotPassword(dto);
  // }

  // @Post("reset-password")
  // @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { limit: getThrottleLimit(5, 100), ttl: 60000 } })
  // @ApiOperation({
  //   summary: "Сбросить пароль",
  //   description:
  //     "Сбрасывает пароль используя токен из email. После сброса все refresh токены пользователя будут отозваны.",
  // })
  // @ApiBody({ type: ResetPasswordDto })
  // @ApiResponse({
  //   status: 200,
  //   description: "Пароль успешно сброшен",
  //   schema: {
  //     type: "object",
  //     properties: {
  //       message: {
  //         type: "string",
  //         example: "Password has been reset successfully",
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: "Неверные данные запроса или токен уже использован",
  // })
  // @ApiResponse({ status: 401, description: "Неверный или истекший токен" })
  // async resetPassword(@Body() dto: ResetPasswordDto) {
  //   return this.authService.resetPassword(dto);
  // }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Выйти из системы",
    description:
      "Отзывает refresh токен(ы) пользователя. **Требует access token в заголовке Authorization: Bearer <access_token>**. Если передан refreshToken в body, отзывается только он, иначе отзываются все токены пользователя.",
  })
  @ApiBody({
    required: false,
    schema: {
      type: "object",
      properties: {
        refreshToken: {
          type: "string",
          example: "refresh-token-here",
          nullable: true,
          description:
            "Опционально: конкретный refresh token для отзыва (для logout с конкретного устройства). Если не указан, отзываются все refresh tokens пользователя.",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Успешный выход",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Logged out successfully" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description:
      "Не авторизован. Убедитесь, что вы используете access token (не refresh token) в заголовке Authorization: Bearer <access_token>",
  })
  async logout(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Body() body?: { refreshToken?: string },
  ) {
    return this.authService.logout(user.id, body?.refreshToken);
  }

  // @Post("logout-by-refresh-token")
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: "Выйти из системы используя refresh token",
  //   description:
  //     "Альтернативный способ logout, который работает только с refresh token (без access token). Отзывает указанный refresh token. Полезно, когда access token истек, но refresh token еще валиден.",
  // })
  // @ApiBody({
  //   schema: {
  //     type: "object",
  //     required: ["refreshToken"],
  //     properties: {
  //       refreshToken: {
  //         type: "string",
  //         example: "refresh-token-here",
  //         description: "Refresh token для отзыва",
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: "Успешный выход",
  //   schema: {
  //     type: "object",
  //     properties: {
  //       message: { type: "string", example: "Logged out successfully" },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: "Неверные данные запроса (отсутствует refresh token)",
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: "Неверный или истекший refresh token",
  // })
  // async logoutByRefreshToken(@Body() body: { refreshToken: string }) {
  //   if (
  //     !body?.refreshToken ||
  //     typeof body.refreshToken !== "string" ||
  //     body.refreshToken.trim() === ""
  //   ) {
  //     throw new BadRequestException("Refresh token is required");
  //   }
  //   return this.authService.logoutByRefreshToken(body.refreshToken);
  // }
}
