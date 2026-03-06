import { ApiProperty } from "@nestjs/swagger";

export class TokensResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1Ni..." })
  access_token: string;

  @ApiProperty({ example: "refresh-token-here" })
  refresh_token: string;
}
