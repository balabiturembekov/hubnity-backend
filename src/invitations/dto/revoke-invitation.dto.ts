import { IsUUID } from "class-validator";

export class RevokeInvitationDTO {
  @IsUUID()
  invitationId: string;
}
