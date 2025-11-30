import {
  Injectable,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async create(dto: CreateUserDto, companyId: string, creatorRole: UserRole) {
    // Normalize and validate email
    const normalizedEmail = dto.email.toLowerCase().trim();
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new BadRequestException('Email is required');
    }

    // Validate and sanitize name
    const sanitizedName = dto.name.trim();
    if (!sanitizedName || sanitizedName.length < 1) {
      throw new BadRequestException('Name cannot be empty');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        companyId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists in your company');
    }

    if (dto.role) {
      if (dto.role === UserRole.OWNER && creatorRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot create another owner. There can be only one owner per company.');
      }
      if (dto.role === UserRole.SUPER_ADMIN && creatorRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You do not have permission to create a super admin user.');
      }
    } else {
      dto.role = UserRole.EMPLOYEE;
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException('Hourly rate cannot be negative');
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
      }
    }

    // Validate password strength
    const sanitizedPassword = dto.password.trim();
    if (sanitizedPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (sanitizedPassword.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters');
    }
    
    // Check password complexity (at least one letter and one number)
    const hasLetter = /[a-zA-Z]/.test(sanitizedPassword);
    const hasNumber = /[0-9]/.test(sanitizedPassword);
    if (!hasLetter || !hasNumber) {
      throw new BadRequestException('Password must contain at least one letter and one number');
    }

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 12); // Increased salt rounds from 10 to 12 for better security

    const user = await this.prisma.user.create({
      data: {
        ...dto,
        name: sanitizedName,
        email: normalizedEmail,
        password: hashedPassword,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.invalidateUsers(companyId);
    return user;
  }

  async findAll(companyId: string) {
    const cacheKey = `users:${companyId}:all`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.set(cacheKey, users, 300);
    return users;
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found in your company`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, companyId: string, updaterRole: UserRole) {
    // Initial check for existence and companyId
    const existingUser = await this.findOne(id, companyId);

    // Perform update within transaction to ensure atomicity and verify companyId
    const updated = await this.prisma.$transaction(async (tx) => {
      // Verify user exists and belongs to company within transaction
      const currentUser = await tx.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!currentUser) {
        throw new NotFoundException(`User with ID ${id} not found in your company`);
      }

      // Validate and normalize email if provided
      let normalizedEmail: string | undefined;
      if (dto.email) {
        normalizedEmail = dto.email.toLowerCase().trim();
        if (!normalizedEmail || normalizedEmail.length === 0) {
          throw new BadRequestException('Email cannot be empty');
        }

        const existingUserWithEmail = await tx.user.findFirst({
          where: {
            email: normalizedEmail,
            companyId,
            id: { not: id },
          },
        });

        if (existingUserWithEmail) {
          throw new ConflictException('User with this email already exists in your company');
        }
      }

      // Validate role changes
      if (dto.role && dto.role !== currentUser.role) {
        if (dto.role === UserRole.OWNER && updaterRole !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('You cannot change a user\'s role to owner. There can be only one owner per company.');
        }
        if (currentUser.role === UserRole.OWNER && updaterRole !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('You cannot change the owner\'s role.');
        }
        if (dto.role === UserRole.SUPER_ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('You do not have permission to assign super admin role.');
        }
        if (currentUser.role === UserRole.SUPER_ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('You do not have permission to change a super admin\'s role.');
        }
      }

      // Validate and sanitize name if provided
      let sanitizedName: string | undefined;
      if (dto.name) {
        sanitizedName = dto.name.trim();
        if (!sanitizedName || sanitizedName.length < 1) {
          throw new BadRequestException('Name cannot be empty');
        }
      }

      const updateData: any = { ...dto };
      if ('companyId' in updateData) {
        delete updateData.companyId;
      }
      if (normalizedEmail) {
        updateData.email = normalizedEmail;
      }
      if (sanitizedName) {
        updateData.name = sanitizedName;
      }

      // Check for active time entries before deactivating user
      if (dto.status === 'INACTIVE' && currentUser.status === 'ACTIVE') {
        const activeEntries = await tx.timeEntry.findMany({
          where: {
            userId: id,
            status: {
              in: ['RUNNING', 'PAUSED'],
            },
            user: {
              companyId,
            },
          },
        });

        if (activeEntries.length > 0) {
          throw new BadRequestException(
            `Cannot deactivate user with active time entries. Please stop all running/paused timers first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
          );
        }
      }

      if (dto.hourlyRate !== undefined) {
        if (dto.hourlyRate < 0) {
          throw new BadRequestException('Hourly rate cannot be negative');
        }
        if (dto.hourlyRate > 10000) {
          throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
        }
      }

      if (dto.password) {
        const sanitizedPassword = dto.password.trim();
        if (!sanitizedPassword || sanitizedPassword.length === 0) {
          throw new BadRequestException('Password cannot be empty');
        }
        // Validate password strength
        if (sanitizedPassword.length < 8) {
          throw new BadRequestException('Password must be at least 8 characters long');
        }
        if (sanitizedPassword.length > 128) {
          throw new BadRequestException('Password must not exceed 128 characters');
        }
        
        // Check password complexity (at least one letter and one number)
        const hasLetter = /[a-zA-Z]/.test(sanitizedPassword);
        const hasNumber = /[0-9]/.test(sanitizedPassword);
        if (!hasLetter || !hasNumber) {
          throw new BadRequestException('Password must contain at least one letter and one number');
        }

        updateData.password = await bcrypt.hash(sanitizedPassword, 12); // Increased salt rounds from 10 to 12 for better security
      }

      return tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatar: true,
          hourlyRate: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    await this.cache.invalidateUsers(companyId);
    return updated;
  }

  async remove(id: string, companyId: string, deleterRole: UserRole) {
    // Initial check for existence and companyId
    const user = await this.findOne(id, companyId);

    // Perform deletion within transaction to ensure atomicity and verify companyId
    const deleted = await this.prisma.$transaction(async (tx) => {
      // Verify user exists and belongs to company within transaction
      const currentUser = await tx.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!currentUser) {
        throw new NotFoundException(`User with ID ${id} not found in your company`);
      }

      // Check permissions
      if (currentUser.role === UserRole.OWNER && deleterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot delete the owner of the company');
      }

      if (currentUser.role === UserRole.SUPER_ADMIN && deleterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You do not have permission to delete a super admin');
      }

      // Check for active time entries
      const activeEntries = await tx.timeEntry.findMany({
        where: {
          userId: id,
          status: {
            in: ['RUNNING', 'PAUSED'],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntries.length > 0) {
        throw new BadRequestException(
          `Cannot delete user with active time entries. Please stop all running/paused timers first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
        );
      }

      return tx.user.delete({
        where: { id },
      });
    });

    await this.cache.invalidateUsers(companyId);
    return deleted;
  }
}

