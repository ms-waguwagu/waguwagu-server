import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { AuthModule } from '../auth/auth.module';
import { MatchingWorker } from './matching-worker.service';

@Module({
  imports: [AuthModule],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingWorker],
})
export class MatchingModule {}
