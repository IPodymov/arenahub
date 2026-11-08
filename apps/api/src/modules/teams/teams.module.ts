import { Module } from '@nestjs/common';
import { InvitesController, TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController, InvitesController],
  providers: [TeamsService],
})
export class TeamsModule {}
