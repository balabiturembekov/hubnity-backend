import { ApiProperty } from "@nestjs/swagger";

class UserResponseDto {
  @ApiProperty({ example: "uuid" })
  id: string;

  @ApiProperty({ example: "John" })
  firstName: string;

  @ApiProperty({ example: "Doe" })
  lastName: string;

  @ApiProperty({ example: "john@example.com" })
  email: string;

  @ApiProperty({ nullable: true, example: "https://example.com" })
  avatar: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: "eyJhbGciOiJIUzI1Ni..." })
  access_token: string;

  @ApiProperty({ example: "refresh-token-here" })
  refresh_token: string;
}
