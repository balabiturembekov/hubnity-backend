import { Module } from '@nestjs/common';
import { TeamActivityController } from './team-activity.controller';
import { TeamActivityService } from './team-activity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TeamActivityController],
  providers: [TeamActivityService],
  exports: [TeamActivityService],
})
export class TeamActivityModule {}

