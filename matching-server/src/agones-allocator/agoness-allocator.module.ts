import { Module } from '@nestjs/common';
import { AgonesAllocatorController } from './agoness-allocator.controller';
import { AgonesAllocatorService } from './agoness-allocator.service';
import { Route53Service } from './route53.service';

@Module({
  controllers: [AgonesAllocatorController],
  providers: [AgonesAllocatorService, Route53Service],
	exports: [AgonesAllocatorService, Route53Service]
})
export class AgonesAllocatorModule {}
