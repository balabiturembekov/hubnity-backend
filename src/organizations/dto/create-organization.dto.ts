import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
  IsFQDN,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: "Name can only contain letters, numbers and spaces",
  })
  @Transform(({ value }) => value.trim())
  name: string;

  @IsOptional()
  @IsFQDN(
    { require_tld: true, allow_underscores: false },
    { message: "Invalid domain format" },
  )
  @Length(3, 255)
  @Transform(({ value }) => value.trim())
  domain: string;
}
