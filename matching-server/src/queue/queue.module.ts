import { Module } from '@nestjs/common';
import { QueueGateway } from './queue.gateway';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [AuthModule],
	controllers: [QueueController],
	providers: [QueueGateway, QueueService],
	exports: [QueueService],
})
export class QueueModule {}
