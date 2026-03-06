import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private readonly userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
  } as const;

  private readonly memberInclude = {
    user: { select: this.userSelect },
  } as const;

  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    try {
      const users = await this.prisma.organizationMember.findMany({
        where: { organizationId },
        include: this.memberInclude,
      });

      return users.map((user) => user.user);
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("Failed to fetch users");
    }
  }
}
