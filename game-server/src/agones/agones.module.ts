import { Module } from '@nestjs/common';
import { AgonesService } from './agones.service';

@Module({
  providers: [AgonesService],
  exports: [AgonesService],
})
export class AgonesModule {}
