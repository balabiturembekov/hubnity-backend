import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadScreenshotDto {
  @ApiProperty({
    description: 'Изображение в формате base64 (data:image/png;base64,...)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    maxLength: 52428800, // 50MB
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50 * 1024 * 1024, {
    message: 'Image data exceeds maximum size (50MB)',
  })
  imageData: string;

  @ApiProperty({
    description: 'ID записи времени, к которой привязан скриншот',
    example: 'uuid',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  timeEntryId: string;
}

