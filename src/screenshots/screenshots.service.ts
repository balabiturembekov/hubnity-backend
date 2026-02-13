import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import sharp from "sharp";
import { UploadScreenshotDto } from "./dto/upload-screenshot.dto";

@Injectable()
export class ScreenshotsService {
  private uploadsDir = path.join(process.cwd(), "uploads", "screenshots");
  private thumbnailsDir = path.join(process.cwd(), "uploads", "thumbnails");
  private directoriesInitialized = false;

  constructor(
    private prisma: PrismaService,
    private logger: PinoLogger,
  ) {
    this.logger.setContext(ScreenshotsService.name);
    this.ensureDirectoriesExist().catch((error) => {
      this.logger.error(
        { error: error.message, stack: error.stack },
        "Failed to initialize upload directories",
      );
    });
  }

  async ensureDirectoriesExist() {
    if (this.directoriesInitialized) return;
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
      this.directoriesInitialized = true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        { error: errorMessage, stack: errorStack },
        "Failed to create upload directories",
      );
      throw error;
    }
  }

  async upload(dto: UploadScreenshotDto, companyId: string, userId: string) {
    await this.ensureDirectoriesExist();

    // Perform all checks within transaction to prevent race conditions
    await this.prisma.$transaction(async (tx) => {
      const timeEntry = await tx.timeEntry.findFirst({
        where: {
          id: dto.timeEntryId,
          user: {
            companyId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!timeEntry) {
        throw new NotFoundException("Time entry not found");
      }

      if (timeEntry.userId !== userId) {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            companyId,
            role: {
              in: ["ADMIN", "OWNER", "SUPER_ADMIN"],
            },
            status: "ACTIVE",
          },
        });

        if (!user) {
          throw new ForbiddenException(
            "You can only upload screenshots for your own time entries",
          );
        }
      }

      return { timeEntry };
    });

    if (!dto.imageData || typeof dto.imageData !== "string") {
      throw new BadRequestException("Invalid image data");
    }

    const maxBase64Length = 50 * 1024 * 1024;
    if (dto.imageData.length > maxBase64Length) {
      throw new BadRequestException("Image data exceeds maximum size (50MB)");
    }

    const base64Data = dto.imageData.replace(
      /^data:image\/(png|jpeg|jpg|webp);base64,/,
      "",
    );
    if (!base64Data || base64Data.length === 0) {
      throw new BadRequestException("Invalid image data format");
    }

    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      throw new BadRequestException("Invalid base64 encoding");
    }

    try {
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, "base64");
      } catch {
        throw new BadRequestException("Failed to decode base64 image data");
      }

      const maxBufferSize = 50 * 1024 * 1024;
      if (imageBuffer.length > maxBufferSize) {
        throw new BadRequestException(
          "Image buffer exceeds maximum size (50MB)",
        );
      }

      if (imageBuffer.length === 0) {
        throw new BadRequestException("Image buffer is empty");
      }

      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filepath = path.join(this.uploadsDir, filename);

      let imageMetadata: sharp.Metadata;
      try {
        imageMetadata = await sharp(imageBuffer).metadata();
        if (!imageMetadata || !imageMetadata.width || !imageMetadata.height) {
          throw new BadRequestException(
            "Invalid image format or corrupted image data",
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException("Invalid or unsupported image format");
      }

      let processedImage: Buffer;
      try {
        processedImage = await sharp(imageBuffer)
          .jpeg({ quality: 85 })
          .resize(1920, 1080, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toBuffer();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          { error: errorMessage, stack: errorStack },
          "Error processing image with sharp",
        );
        throw new BadRequestException("Failed to process image");
      }

      await fs.writeFile(filepath, processedImage);

      const thumbnailFilename = `thumb-${filename}`;
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

      let thumbnail: Buffer;
      try {
        thumbnail = await sharp(imageBuffer)
          .resize(200, 150, {
            fit: "cover",
          })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          { error: errorMessage, stack: errorStack },
          "Error generating thumbnail",
        );
        try {
          await fs.unlink(filepath);
        } catch (deleteError: unknown) {
          const deleteErrorMessage =
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError);
          const deleteErrorStack =
            deleteError instanceof Error ? deleteError.stack : undefined;
          this.logger.error(
            { error: deleteErrorMessage, stack: deleteErrorStack },
            "Failed to cleanup image file after thumbnail error",
          );
        }
        throw new BadRequestException("Failed to generate thumbnail");
      }

      await fs.writeFile(thumbnailPath, thumbnail);

      const screenshot = await this.prisma.screenshot.create({
        data: {
          timeEntryId: dto.timeEntryId,
          imageUrl: `/uploads/screenshots/${filename}`,
          thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
          timestamp: new Date(),
        },
        include: {
          timeEntry: {
            select: {
              id: true,
              userId: true,
              projectId: true,
            },
          },
        },
      });

      return screenshot;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        {
          error: errorMessage,
          stack: errorStack,
          timeEntryId: dto.timeEntryId,
          userId,
          companyId,
        },
        "Error saving screenshot",
      );
      throw new BadRequestException("Failed to save screenshot");
    }
  }

  async findByTimeEntry(
    timeEntryId: string,
    companyId: string,
    userId: string,
    limit: number = 100,
  ) {
    // Perform all checks within transaction to prevent race conditions
    await this.prisma.$transaction(async (tx) => {
      const timeEntry = await tx.timeEntry.findFirst({
        where: {
          id: timeEntryId,
          user: {
            companyId,
          },
        },
      });

      if (!timeEntry) {
        throw new NotFoundException("Time entry not found");
      }

      if (timeEntry.userId !== userId) {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            companyId,
            role: {
              in: ["ADMIN", "OWNER", "SUPER_ADMIN"],
            },
            status: "ACTIVE",
          },
        });

        if (!user) {
          throw new ForbiddenException("Access denied");
        }
      }

      return { timeEntry };
    });

    return this.prisma.screenshot.findMany({
      where: {
        timeEntryId,
      },
      take: limit,
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async delete(screenshotId: string, companyId: string, userId: string) {
    // Perform deletion within transaction to ensure atomicity and verify companyId
    await this.prisma.$transaction(async (tx) => {
      // Verify screenshot exists and belongs to company within transaction
      const screenshot = await tx.screenshot.findUnique({
        where: { id: screenshotId },
        include: {
          timeEntry: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!screenshot) {
        throw new NotFoundException("Screenshot not found");
      }

      // Check for null timeEntry or user
      if (!screenshot.timeEntry || !screenshot.timeEntry.user) {
        throw new NotFoundException(
          "Time entry or user not found for this screenshot",
        );
      }

      // Verify companyId
      if (screenshot.timeEntry.user.companyId !== companyId) {
        throw new ForbiddenException("Access denied");
      }

      // Check permissions
      if (screenshot.timeEntry.userId !== userId) {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            companyId,
            role: {
              in: ["ADMIN", "OWNER", "SUPER_ADMIN"],
            },
          },
        });

        if (!user) {
          throw new ForbiddenException("Access denied");
        }
      }

      // Delete files
      try {
        const normalizeAndValidatePath = (
          fileUrl: string,
          expectedDir: string,
        ): string | null => {
          if (!fileUrl) return null;
          if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
            return null;
          }
          const normalizedUrl = fileUrl.startsWith("/")
            ? fileUrl.substring(1)
            : fileUrl;
          const resolvedPath = path.resolve(process.cwd(), normalizedUrl);
          const expectedDirPath = path.resolve(expectedDir);

          if (
            !resolvedPath.startsWith(expectedDirPath + path.sep) &&
            resolvedPath !== expectedDirPath
          ) {
            this.logger.warn(
              `Path traversal attempt detected: ${fileUrl} resolved to ${resolvedPath}, expected within ${expectedDirPath}`,
            );
            return null;
          }
          return resolvedPath;
        };

        const imagePath = normalizeAndValidatePath(
          screenshot.imageUrl,
          this.uploadsDir,
        );
        const thumbnailPath = screenshot.thumbnailUrl
          ? normalizeAndValidatePath(
              screenshot.thumbnailUrl,
              this.thumbnailsDir,
            )
          : null;

        if (imagePath && fsSync.existsSync(imagePath)) {
          await fs.unlink(imagePath);
        }

        if (thumbnailPath && fsSync.existsSync(thumbnailPath)) {
          await fs.unlink(thumbnailPath);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          {
            error: errorMessage,
            stack: errorStack,
            screenshotId,
            imageUrl: screenshot.imageUrl,
          },
          "Error deleting screenshot files",
        );
        // Continue with database deletion even if file deletion fails
      }

      // Delete database record
      return tx.screenshot.delete({
        where: { id: screenshotId },
      });
    });

    return { success: true };
  }
}
