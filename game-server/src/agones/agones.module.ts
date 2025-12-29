import { Module } from '@nestjs/common';
import { AgonesService } from './agones.service';
import { AgonesController } from './agones.controller';

@Module({
	controllers: [AgonesController],
  providers: [AgonesService],
  exports: [AgonesService],
})
export class AgonesModule {}
