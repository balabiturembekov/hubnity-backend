import { IsString, IsNotEmpty, IsUUID } from "class-validator";

export class GetOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
