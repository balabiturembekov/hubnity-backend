import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBlockedUrlDto } from "./dto/create-blocked-url.dto";
import { UserRole } from "@prisma/client";

@Injectable()
export class BlockedUrlService {
  private readonly logger = new Logger(BlockedUrlService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Получить все заблокированные URL для компании
   */
  async findAll(companyId: string, userRole: UserRole) {
    // Только админы могут просматривать заблокированные URL
    if (
      userRole !== UserRole.OWNER &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException("Only admins can view blocked URLs");
    }

    return this.prisma.blockedUrl.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Создать заблокированный URL
   */
  async create(
    dto: CreateBlockedUrlDto,
    companyId: string,
    userRole: UserRole,
  ) {
    // Только админы могут создавать заблокированные URL
    if (
      userRole !== UserRole.OWNER &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException("Only admins can create blocked URLs");
    }

    // Должен быть указан хотя бы один параметр
    if (!dto.url && !dto.domain && !dto.pattern) {
      throw new BadRequestException(
        "At least one of url, domain, or pattern must be provided",
      );
    }

    // Валидация regex паттерна
    if (dto.pattern) {
      try {
        new RegExp(dto.pattern);
      } catch (error) {
        throw new BadRequestException(
          `Invalid regex pattern: ${(error as Error).message}`,
        );
      }
    }

    // Нормализация данных
    const normalizedUrl = dto.url?.trim() || null;
    const normalizedDomain = dto.domain?.trim().toLowerCase() || null;
    const normalizedPattern = dto.pattern?.trim() || null;

    // Используем транзакцию для предотвращения race condition
    const blockedUrl = await this.prisma.$transaction(async (tx) => {
      // Проверка на дубликаты - проверяем все возможные комбинации внутри транзакции
      const orConditions = [];

      if (normalizedUrl) {
        orConditions.push({ url: normalizedUrl });
      }
      if (normalizedDomain) {
        orConditions.push({ domain: normalizedDomain });
      }
      if (normalizedPattern) {
        orConditions.push({ pattern: normalizedPattern });
      }
      // Полное совпадение всех полей (если все указаны)
      if (normalizedUrl && normalizedDomain && normalizedPattern) {
        orConditions.push({
          url: normalizedUrl,
          domain: normalizedDomain,
          pattern: normalizedPattern,
        });
      }

      // Если все поля null, это уже проверено выше (должен быть хотя бы один параметр)
      if (orConditions.length === 0) {
        throw new BadRequestException(
          "At least one of url, domain, or pattern must be provided",
        );
      }

      // Проверка на дубликаты внутри транзакции
      const existing = await tx.blockedUrl.findFirst({
        where: {
          companyId,
          OR: orConditions,
        },
      });

      if (existing) {
        throw new BadRequestException(
          "This URL/domain/pattern is already blocked",
        );
      }

      return tx.blockedUrl.create({
        data: {
          companyId,
          url: normalizedUrl,
          domain: normalizedDomain,
          pattern: normalizedPattern,
        },
      });
    });

    this.logger.debug(
      {
        blockedUrlId: blockedUrl.id,
        url: blockedUrl.url,
        domain: blockedUrl.domain,
        pattern: blockedUrl.pattern,
        companyId,
      },
      "Blocked URL created",
    );

    return blockedUrl;
  }

  /**
   * Удалить заблокированный URL
   */
  async delete(blockedUrlId: string, companyId: string, userRole: UserRole) {
    // Только админы могут удалять заблокированные URL
    if (
      userRole !== UserRole.OWNER &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException("Only admins can delete blocked URLs");
    }

    const blockedUrl = await this.prisma.blockedUrl.findFirst({
      where: {
        id: blockedUrlId,
        companyId,
      },
    });

    if (!blockedUrl) {
      throw new NotFoundException("Blocked URL not found");
    }

    await this.prisma.blockedUrl.delete({
      where: {
        id: blockedUrlId,
      },
    });

    this.logger.debug(
      {
        blockedUrlId,
        companyId,
      },
      "Blocked URL deleted",
    );

    return { success: true };
  }
}
