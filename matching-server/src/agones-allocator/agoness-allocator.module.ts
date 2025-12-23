import { Module } from '@nestjs/common';
import { AgonesAllocatorController } from './agoness-allocator.controller';
import { AgonesAllocatorService } from './agoness-allocator.service';

@Module({
  controllers: [AgonesAllocatorController],
  providers: [AgonesAllocatorService],
	exports: [AgonesAllocatorService]
})
export class AgonesAllocatorModule {}
