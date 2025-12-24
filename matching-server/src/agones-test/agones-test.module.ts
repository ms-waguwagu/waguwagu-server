import { Module } from '@nestjs/common';
import { AgonesTestController } from './agones-test.controller';
import { AgonesTestService } from './agones-test.service';

@Module({
	imports: [],
	controllers: [AgonesTestController],
	providers: [AgonesTestService],
	exports: [],
})
export class AgonesTestModule {}
