import { Module } from '@nestjs/common';
import { AgonesController } from './agones.controller';
import { AgonesTestService } from './agones-test.service';

@Module({
	imports: [],
	controllers: [AgonesController],
	providers: [AgonesTestService],
	exports: [],
})
export class AgonesModule {}
