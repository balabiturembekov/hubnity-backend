import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GetUser } from "./decorators/get-user.decorator";
import { JwtService } from "@nestjs/jwt";

// Helper to get throttle limit based on environment
const getThrottleLimit = (prodLimit: number, devLimit: number = 100) => {
  return process.env.NODE_ENV === "production" ? prodLimit : devLimit;
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: getThrottleLimit(3, 100), ttl: 60000 } })
  @ApiOperation({ summary: "Регистрация нового пользователя" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "Пользователь успешно создан",
    schema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            firstName: { type: "string", example: "Иван" },
            lastName: { type: "string", example: "Иванов" },
            email: { type: "string", example: "user@example.com" },
            avatar: {
              type: "string",
              nullable: true,
              example: "https://example.com/avatar.jpg",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            deletedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        access_token: {
          type: "string",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        },
        refresh_token: { type: "string", example: "refresh-token-here" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 409, description: "Пользователь уже существует" })
  @ApiResponse({ status: 500, description: "Внутренняя ошибка сервера" })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(5, 100), ttl: 60000 } })
  @ApiOperation({
    summary: "Вход в систему",
    description:
      "Аутентификация пользователя по email и паролю. Возвращает JWT токен.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Успешный вход",
    schema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "user@example.com" },
            avatar: {
              type: "string",
              nullable: true,
              example: "https://example.com/avatar.jpg",
            },
            hourlyRate: { type: "number", nullable: true, example: 25.5 },
          },
        },
        access_token: {
          type: "string",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        },
        refresh_token: { type: "string", example: "refresh-token-here" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Неверные учетные данные" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Получить текущего пользователя",
    description:
      "Возвращает полную информацию о текущем пользователе. Рекомендуется использовать GET /users/me для единообразия.",
  })
  @ApiResponse({
    status: 200,
    description: "Информация о пользователе",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Иван Иванов" },
        email: { type: "string", example: "user@example.com" },
        role: {
          type: "string",
          enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
          example: "OWNER",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE"],
          example: "ACTIVE",
        },
        avatar: { type: "string", nullable: true },
        hourlyRate: { type: "number", nullable: true },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getProfile(@GetUser() user: any) {
    // return this.usersService.findOne(user.id, user.companyId);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(10, 200), ttl: 60000 } })
  @ApiOperation({
    summary: "Обновить access token",
    description:
      "Обновляет access token используя refresh token. Возвращает новую пару токенов.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Токены успешно обновлены",
    schema: {
      type: "object",
      properties: {
        access_token: {
          type: "string",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        },
        refresh_token: { type: "string", example: "refresh-token-here" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или истекший refresh token",
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: getThrottleLimit(5, 100), ttl: 60000 } })
  @ApiOperation({
    summary: "Сменить пароль",
    description:
      "Изменяет пароль текущего пользователя. Требует текущий пароль для подтверждения.",
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: "Пароль успешно изменен",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Password changed successfully" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 401, description: "Неверный текущий пароль" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async changePassword(@GetUser() user: any, @Body() dto: ChangePasswordDto) {
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

  // auth.controller.ts
  @Post("debug-token")
  async debugToken(@Headers("authorization") auth: string) {
    // 👈 Правильный декоратор
    if (!auth) {
      return {
        valid: false,
        error: "No authorization header",
      };
    }

    const token = auth.replace("Bearer ", "");

    try {
      // Попробуем верифицировать токен
      const decoded = this.jwtService.verify(token);
      return {
        valid: true,
        decoded,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        token: token.substring(0, 20) + "...", // покажем часть токена для отладки
      };
    }
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
