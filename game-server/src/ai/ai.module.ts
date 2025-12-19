import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AiService } from './ai.service';
import { join } from 'path';

@Module({
  imports: [
    // ClientsModule.register([
    //   {
    //     name: 'BOSS_AI_PACKAGE',
    //     transport: Transport.GRPC,
    //     options: {
    //       url: 'localhost:50051',
    //       package: 'ai',
    //       protoPath: join(process.cwd(), 'src/proto/ai.proto'),
    //     },
    //   },
    // ]),
  ],
  providers: [],
  exports: [],
})
export class AiModule {}
