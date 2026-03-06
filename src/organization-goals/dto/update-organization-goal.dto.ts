import { PartialType } from "@nestjs/swagger";
import { CreateOrganizationGoalDto } from "./create-organization-goal.dto";

export class UpdateOrganizationGoalDto extends PartialType(
  CreateOrganizationGoalDto,
) {}
