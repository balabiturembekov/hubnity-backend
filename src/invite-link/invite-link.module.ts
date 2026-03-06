import { Module } from '@nestjs/common';
import { InviteLinkService } from './invite-link.service';
import { InviteLinkController } from './invite-link.controller';

@Module({
  controllers: [InviteLinkController],
  providers: [InviteLinkService],
})
export class InviteLinkModule {}
