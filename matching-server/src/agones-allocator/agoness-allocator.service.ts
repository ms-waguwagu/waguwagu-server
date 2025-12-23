import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';

@Injectable()
export class AgonesAllocatorService {
  private readonly logger = new Logger(AgonesAllocatorService.name);

	// kubectl get svc -n agones-system
// https://k8s-agonessy-agonesal-009dcdfc73-163385f94af508ae.elb.ap-northeast-2.amazonaws.com
  private readonly endpoint = process.env.AGONES_ALLOCATOR_ENDPOINT!;
  private readonly namespace = 'game';          // Agones Fleet namespace
  private readonly fleetName = 'waguwagu-fleet'; // Fleet 이름

  private readonly httpsAgent = new https.Agent({
    cert: fs.readFileSync(process.env.AGONES_CLIENT_CERT_PATH!),
    key: fs.readFileSync(process.env.AGONES_CLIENT_KEY_PATH!),
    ca: fs.readFileSync(process.env.AGONES_CA_CERT_PATH!),
    rejectUnauthorized: true,
    checkServerIdentity: () => undefined,
		
  });

  async allocate(): Promise<{ address: string; port: number }> {
    const url = `${this.endpoint}/gameserverallocation`;

    const body = {
      apiVersion: 'allocation.agones.dev/v1',
      kind: 'GameServerAllocation',
      spec: {
        selectors: [
          {
            matchLabels: {
              'agones.dev/fleet': 'waguwagu-fleet',
            },
          },
        ],
      },
    };

    this.logger.log('[Agones] allocator 호출 시작');

    const res = await axios.post(url, body, {
      httpsAgent: this.httpsAgent,
			timeout: 3000, // 반드시 넣기
    });
		this.logger.log('[ALLOCATOR] 호출 직후');

    const status = res.data.status;

    const address = status.address;
    const port = status.ports[0].port;

    this.logger.log(`[Agones] 할당 성공: ${address}:${port}`);

    return { address, port };
  }
}
