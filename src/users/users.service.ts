import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findOne(userId: string) {
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
      return user;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("Failed to fetch user");
    }
  }

  async update(userId: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateUserDto,
      });

      delete updatedUser.password;
      delete updatedUser.deletedAt;
      return updatedUser;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("Failed to update user");
    }
  }

  async remove(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("Failed to delete user");
    }
  }
}
