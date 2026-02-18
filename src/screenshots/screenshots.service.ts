import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../s3/s3.service";
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
    private s3Service: S3Service,
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

    const maxBase64Length = 10 * 1024 * 1024;
    if (dto.imageData.length > maxBase64Length) {
      throw new BadRequestException("Image data exceeds maximum size (10MB)");
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

      const maxBufferSize = 10 * 1024 * 1024;
      if (imageBuffer.length > maxBufferSize) {
        throw new BadRequestException(
          "Image buffer exceeds maximum size (10MB)",
        );
      }

      if (imageBuffer.length === 0) {
        throw new BadRequestException("Image buffer is empty");
      }

      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const thumbnailFilename = `thumb-${filename}`;

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
        this.logger.error(
          { error: errorMessage },
          "Error generating thumbnail",
        );
        throw new BadRequestException("Failed to generate thumbnail");
      }

      let imageUrl: string;
      let thumbnailUrl: string | null = null;

      if (this.s3Service.isEnabled()) {
        const s3ImageKey = `screenshots/${filename}`;
        const s3ThumbKey = `thumbnails/${thumbnailFilename}`;
        const uploadedImageUrl = await this.s3Service.uploadBuffer(
          s3ImageKey,
          processedImage,
          "image/jpeg",
        );
        const uploadedThumbUrl = await this.s3Service.uploadBuffer(
          s3ThumbKey,
          thumbnail,
          "image/jpeg",
        );
        if (!uploadedImageUrl) {
          throw new BadRequestException("S3 upload failed");
        }
        imageUrl = uploadedImageUrl;
        thumbnailUrl = uploadedThumbUrl;
      } else {
        const filepath = path.join(this.uploadsDir, filename);
        const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);
        await fs.writeFile(filepath, processedImage);
        await fs.writeFile(thumbnailPath, thumbnail);
        imageUrl = `/uploads/screenshots/${filename}`;
        thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
      }

      const screenshot = await this.prisma.screenshot.create({
        data: {
          timeEntryId: dto.timeEntryId,
          imageUrl,
          thumbnailUrl,
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

  /**
   * Delete S3 objects and local files for all screenshots of a time entry.
   * Call BEFORE deleting a TimeEntry (or User) to avoid orphaned files on cascade.
   * Uses batch S3 delete when possible. Never throws — logs errors for admin cleanup.
   */
  async deleteFilesForTimeEntry(timeEntryId: string): Promise<void> {
    const screenshots = await this.prisma.screenshot.findMany({
      where: { timeEntryId },
      select: { id: true, imageUrl: true, thumbnailUrl: true },
    });

    if (this.s3Service.isEnabled()) {
      const keys: string[] = [];
      for (const s of screenshots) {
        const imageKey = this.s3Service.extractKeyFromUrl(s.imageUrl);
        const thumbKey = s.thumbnailUrl
          ? this.s3Service.extractKeyFromUrl(s.thumbnailUrl)
          : null;
        if (imageKey) keys.push(imageKey);
        if (thumbKey) keys.push(thumbKey);
      }
      if (keys.length > 0) {
        await this.s3Service.deleteObjects(keys);
      }
    }

    for (const screenshot of screenshots) {
      await this.deleteLocalFilesForScreenshot(screenshot, timeEntryId);
    }
  }

  private async deleteLocalFilesForScreenshot(
    screenshot: { imageUrl: string; thumbnailUrl: string | null },
    contextId: string,
  ): Promise<void> {
    if (!this.s3Service.isEnabled()) {
      try {
        const imagePath = this.normalizeAndValidatePath(
          screenshot.imageUrl,
          this.uploadsDir,
        );
        const thumbnailPath = screenshot.thumbnailUrl
          ? this.normalizeAndValidatePath(
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
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          {
            contextId,
            imageUrl: screenshot.imageUrl,
            thumbnailUrl: screenshot.thumbnailUrl,
            error: msg,
          },
          "Local file delete failed — admin may need to clean up manually",
        );
      }
    }
  }

  /**
   * Delete S3 objects and local files for all screenshots belonging to a user's time entries.
   * Call BEFORE deleting a User to avoid orphaned files on cascade.
   * Uses batch S3 delete. Never throws — logs errors for admin cleanup.
   */
  async deleteFilesForUser(userId: string): Promise<void> {
    const screenshots = await this.prisma.screenshot.findMany({
      where: { timeEntry: { userId } },
      select: { id: true, imageUrl: true, thumbnailUrl: true },
    });

    if (this.s3Service.isEnabled()) {
      const keys: string[] = [];
      for (const s of screenshots) {
        const imageKey = this.s3Service.extractKeyFromUrl(s.imageUrl);
        const thumbKey = s.thumbnailUrl
          ? this.s3Service.extractKeyFromUrl(s.thumbnailUrl)
          : null;
        if (imageKey) keys.push(imageKey);
        if (thumbKey) keys.push(thumbKey);
      }
      if (keys.length > 0) {
        await this.s3Service.deleteObjects(keys);
      }
    }

    for (const screenshot of screenshots) {
      await this.deleteLocalFilesForScreenshot(screenshot, `user:${userId}`);
    }
  }

  /**
   * Delete S3/local files for a single screenshot. Used by delete(screenshotId).
   * Never throws — logs errors for admin cleanup.
   */
  private async deleteFilesForScreenshot(screenshot: {
    id?: string;
    imageUrl: string;
    thumbnailUrl: string | null;
  }): Promise<void> {
    const contextId = screenshot.id ?? "unknown";
    if (this.s3Service.isEnabled()) {
      const imageKey = this.s3Service.extractKeyFromUrl(screenshot.imageUrl);
      const thumbKey = screenshot.thumbnailUrl
        ? this.s3Service.extractKeyFromUrl(screenshot.thumbnailUrl)
        : null;
      if (imageKey) await this.s3Service.deleteObject(imageKey);
      if (thumbKey) await this.s3Service.deleteObject(thumbKey);
    } else {
      await this.deleteLocalFilesForScreenshot(screenshot, contextId);
    }
  }

  private normalizeAndValidatePath(
    fileUrl: string,
    expectedDir: string,
  ): string | null {
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
        `Path traversal attempt detected: ${fileUrl} resolved to ${resolvedPath}`,
      );
      return null;
    }
    return resolvedPath;
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

      // Delete files (S3 or local)
      await this.deleteFilesForScreenshot(screenshot);

      // Delete database record
      return tx.screenshot.delete({
        where: { id: screenshotId },
      });
    });

    return { success: true };
  }
}
