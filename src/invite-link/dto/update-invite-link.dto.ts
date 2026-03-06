import { PartialType } from '@nestjs/swagger';
import { CreateInviteLinkDto } from './create-invite-link.dto';

export class UpdateInviteLinkDto extends PartialType(CreateInviteLinkDto) {}
