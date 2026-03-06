// time-entries/screenshots.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Body,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { TimeEntriesService } from "./time-entries.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import {
  UploadScreenshotDto,
  ScreenshotResponseDto,
  ScreenshotFilterDto,
} from "./dto/screenshot.dto";

@ApiTags("screenshots")
@ApiBearerAuth()
@Controller("time-entries/:timeEntryId/screenshots")
@UseGuards(JwtAuthGuard)
export class ScreenshotsController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  @ApiOperation({ summary: "Upload screenshot for time entry" })
  @ApiParam({ name: "timeEntryId", format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/screenshots",
        filename: (req, file, cb) => {
          const timeEntryId = req.params.timeEntryId;
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join("");
          return cb(
            null,
            `${timeEntryId}_${randomName}${extname(file.originalname)}`,
          );
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
          return cb(new Error("Only image files are allowed!"), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Screenshot uploaded successfully",
    type: ScreenshotResponseDto,
  })
  async uploadScreenshot(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadScreenshotDto,
  ): Promise<ScreenshotResponseDto> {
    console.log("📸 Upload screenshot request:");
    console.log("  timeEntryId:", timeEntryId);
    console.log("  userId:", userId);
    console.log("  file:", file?.originalname);
    console.log("  raw dto:", dto);
    console.log("  isBlurred value:", dto.isBlurred);
    console.log("  isBlurred type:", typeof dto.isBlurred);

    let processedIsBlurred = false;
    if (dto.isBlurred !== undefined) {
      if (typeof dto.isBlurred === "boolean") {
        processedIsBlurred = dto.isBlurred;
      } else if (typeof dto.isBlurred === "string") {
        processedIsBlurred = dto.isBlurred === "true";
      } else if (typeof dto.isBlurred === "number") {
        processedIsBlurred = dto.isBlurred === 1;
      }
    }

    console.log("  🔧 Processed isBlurred:", processedIsBlurred);
    console.log("  final type:", typeof processedIsBlurred);

    const processedDto = {
      ...dto,
      isBlurred: processedIsBlurred,
    };

    console.log("  processed DTO:", processedDto);
    console.log("  final isBlurred type:", typeof processedDto.isBlurred);

    return this.timeEntriesService.uploadScreenshot(
      timeEntryId,
      userId,
      file,
      processedDto,
    );
  }

  @Get()
  @ApiOperation({ summary: "Get screenshots for time entry" })
  @ApiParam({ name: "timeEntryId", format: "uuid" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of screenshots",
    type: [ScreenshotResponseDto],
  })
  async getScreenshots(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
    @Query() filter: ScreenshotFilterDto,
  ): Promise<ScreenshotResponseDto[]> {
    return this.timeEntriesService.getScreenshots(timeEntryId, userId, filter);
  }

  @Delete(":screenshotId")
  @ApiOperation({ summary: "Delete screenshot" })
  @ApiParam({ name: "timeEntryId", format: "uuid" })
  @ApiParam({ name: "screenshotId", format: "uuid" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Screenshot deleted",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteScreenshot(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @Param("screenshotId", ParseUUIDPipe) screenshotId: string,
    @GetUser("id") userId: string,
  ): Promise<void> {
    await this.timeEntriesService.deleteScreenshot(screenshotId, userId);
  }
}
