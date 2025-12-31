import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class AgonesAllocatorService {
  private readonly logger = new Logger(AgonesAllocatorService.name);

  private readonly endpoint = process.env.AGONES_ALLOCATOR_ENDPOINT!;
  private readonly namespace = 'game';
  private readonly fleetName = 'waguwagu-fleet';

  private readonly httpsAgent = new https.Agent({
    cert: fs.readFileSync(process.env.AGONES_CLIENT_CERT_PATH!),
    key: fs.readFileSync(process.env.AGONES_CLIENT_KEY_PATH!),
    ca: fs.readFileSync(process.env.AGONES_CA_CERT_PATH!),
    rejectUnauthorized: true,
    checkServerIdentity: () => undefined,
  });

  async allocate(): Promise<{ gameserverIp: string; gameserverName: string; port: number } | null> {
    // TEST: allocator 중복 호출 여부 확인용 requestId
    const requestId = crypto.randomUUID();

    const url = `${this.endpoint}/gameserverallocation`;
    const body = {
      namespace: this.namespace,
      required: {
        matchLabels: {
          'agones.dev/fleet': this.fleetName,
        },
      },
    };

    // TEST
    this.logger.log(`[Agones][${requestId}] allocator 호출 시작`);

    const start = Date.now();
    let res;

    try {
      res = await axios.post(url, body, {
        httpsAgent: this.httpsAgent,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - start;

      // TEST
      this.logger.log(
        `[Agones][${requestId}] allocator 응답 수신 (소요시간: ${duration}ms)`,
      );
      this.logger.log(
        `[Agones][${requestId}] allocator raw response`,
        JSON.stringify(res.data, null, 2),
      );
      this.logger.log(
        `[Agones][${requestId}] allocator response keys`,
        Object.keys(res.data ?? {}),
      );
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.warn(error);
        // TEST
        this.logger.warn(
          `[Agones][${requestId}] 사용 가능한 GameServer 없음 `,
        );
        return null;
      }

      this.logger.error(
        `[Agones][${requestId}] allocator 요청 실패: ${error.message}, Code: ${error.code}`,
        error.response?.data,
      );
      throw error;
    }

    // const gameServer = res.data?.gameServer;
    // const status = gameServer?.status;
    // const address = status?.address;
    // const port = status?.ports?.[0]?.port;

		const port = res.data?.ports?.[0]?.port;

		const externalIp = res.data?.addresses?.find((a) => a.type === 'ExternalIP')?.address;
		const externalDns = res.data?.addresses?.find((a) => a.type === 'ExternalDNS')?.address;

		// 최종 gameserverIp 결정
		const gameserverIp = externalIp ?? externalDns ?? res.data?.address;

		const gameserverName = res.data?.gameServerName;

    if (!gameserverIp || !port || !gameserverName) {
      this.logger.error(
        `[Agones][${requestId}] allocation 응답 파싱 실패`,
        JSON.stringify(res.data, null, 2),
      );
      throw new Error('Agones allocation 응답이 올바르지 않습니다');
    }

    // TEST
    this.logger.log(
      `[Agones][${requestId}] 할당 성공: ${gameserverName} (${gameserverIp}:${port})`,
    );
    this.logger.log(
      `[Agones][${requestId}] { "gameServerName": "${gameserverName}", "address": "${gameserverIp}", "port": ${port} }`,
    );

    return {
      gameserverIp,
			gameserverName,
      port,

    };
  }
}
