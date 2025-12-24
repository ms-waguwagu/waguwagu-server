import { Module } from '@nestjs/common';
import { QueueGateway } from './queue.gateway';
import { QueueService } from './queue.service';
import { AuthModule } from '../auth/auth.module';

const isLocal = process.env.NODE_ENV === 'local';

@Module({
  imports: [AuthModule],

  providers: [...(!isLocal ? [QueueService, QueueGateway] : [])],

  exports: [...(!isLocal ? [QueueService, QueueGateway] : [])],
})
export class QueueModule {}
