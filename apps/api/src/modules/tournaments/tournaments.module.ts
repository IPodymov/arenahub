import { Module } from '@nestjs/common';
import { AdminTournamentsController } from './admin-tournaments.controller';
import { RegistrationsService } from './registrations.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  controllers: [TournamentsController, AdminTournamentsController],
  providers: [TournamentsService, RegistrationsService],
})
export class TournamentsModule {}
