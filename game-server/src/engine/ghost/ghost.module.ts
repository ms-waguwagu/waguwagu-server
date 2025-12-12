import { Module } from '@nestjs/common';
import { GhostMoveService } from './ghost-move.service';
import { GhostManagerService } from './ghost-manager.service';

@Module({
  providers: [GhostMoveService, GhostManagerService],
  exports: [GhostMoveService, GhostManagerService],
})
export class GhostModule {}
