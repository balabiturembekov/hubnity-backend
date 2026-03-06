import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { OrganizationGoalsService } from "./organization-goals.service";
import { CreateOrganizationGoalDto } from "./dto/create-organization-goal.dto";
import { UpdateOrganizationGoalDto } from "./dto/update-organization-goal.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { OrganizationGoalEntity } from "./entities/organization-goal.entity";

@ApiTags("organization-goals")
@Controller("organization-goals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class OrganizationGoalsController {
  constructor(
    private readonly organizationGoalsService: OrganizationGoalsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create organization goal",
    description: "Create a new organization goal. Only super admins can create.",
  })
  @ApiBody({ type: CreateOrganizationGoalDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Organization goal created successfully",
    type: OrganizationGoalEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Forbidden. Only super admins can create organization goals.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  create(@Body() createOrganizationGoalDto: CreateOrganizationGoalDto) {
    return this.organizationGoalsService.create(createOrganizationGoalDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all organization goals",
    description: "Returns all organization goals. Requires authenticated user.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of organization goals",
    type: [OrganizationGoalEntity],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  findAll() {
    return this.organizationGoalsService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get organization goal by ID",
    description: "Returns a single organization goal. Requires authenticated user.",
  })
  @ApiParam({ name: "id", description: "Organization goal UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization goal found",
    type: OrganizationGoalEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization goal not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.organizationGoalsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Update organization goal",
    description: "Update an organization goal. Only super admins can update.",
  })
  @ApiParam({ name: "id", description: "Organization goal UUID" })
  @ApiBody({ type: UpdateOrganizationGoalDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization goal updated successfully",
    type: OrganizationGoalEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Forbidden. Only super admins can update organization goals.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization goal not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateOrganizationGoalDto: UpdateOrganizationGoalDto,
  ) {
    return this.organizationGoalsService.update(id, updateOrganizationGoalDto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Delete organization goal",
    description: "Delete an organization goal. Only super admins can delete.",
  })
  @ApiParam({ name: "id", description: "Organization goal UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization goal deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Forbidden. Only super admins can delete organization goals.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization goal not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.organizationGoalsService.remove(id);
  }
}
