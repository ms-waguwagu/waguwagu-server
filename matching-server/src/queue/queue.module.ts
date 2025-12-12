import { Module } from '@nestjs/common';
import { QueueGateway } from './queue.gateway';
import { QueueService } from './queue.service';
import { AuthModule } from '../auth/auth.module';


@Module({
	imports: [AuthModule],
	providers: [QueueGateway, QueueService],
	exports: [QueueService, QueueGateway],
})
export class QueueModule {}
