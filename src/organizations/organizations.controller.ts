import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { CompaniesService } from "../companies/companies.service";

/**
 * Hubstaff-style alias: organizations = companies.
 * GET /organizations возвращает список организаций текущего пользователя.
 * В Hubnity пользователь принадлежит одной компании.
 */
@ApiTags("organizations")
@Controller("organizations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class OrganizationsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: "Список организаций (Hubstaff-style)",
    description:
      "Возвращает организации текущего пользователя. В Hubnity пользователь принадлежит одной компании. Аналог Hubstaff GET /organizations.",
  })
  @ApiResponse({
    status: 200,
    description: "Список организаций",
    schema: {
      type: "object",
      properties: {
        organizations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrganizations(@GetUser() user: any) {
    const profile = await this.companiesService.getCompanyProfile(
      user.companyId,
    );
    return {
      organizations: [{ id: profile.id, name: profile.name }],
    };
  }
}
