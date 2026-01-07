/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class AgonesAllocatorService {
  private readonly logger = new Logger(AgonesAllocatorService.name);

  private readonly endpoint = process.env.AGONES_ALLOCATOR_ENDPOINT;
  private readonly namespace = 'game';
  private readonly fleetName = 'waguwagu-fleet';

  private httpsAgent?: https.Agent;

  constructor() {
    const certPath = process.env.AGONES_CLIENT_CERT_PATH;
    const keyPath = process.env.AGONES_CLIENT_KEY_PATH;
    const caPath = process.env.AGONES_CA_CERT_PATH;

    // ⭐ Agones 환경에서만 인증서 로딩
    if (certPath && keyPath && caPath) {
      this.httpsAgent = new https.Agent({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true,
        checkServerIdentity: () => undefined,
      });

      this.logger.log('[Agones] HTTPS Agent initialized');
    } else {
      this.logger.warn(
        '[Agones] 인증서 환경변수가 없어 allocator 비활성화 상태로 시작합니다',
      );
    }
  }

  async allocate(): Promise<{
    gameserverIp: string;
    gameserverName: string;
    port: number;
  } | null> {
    // ⭐ Agones 비활성 상태면 즉시 종료
    if (!this.endpoint || !this.httpsAgent) {
      this.logger.warn('[Agones] allocator 호출 스킵 (비활성 환경)');
      return null;
    }

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

    this.logger.log(`[Agones][${requestId}] allocator 호출 시작`);

    let res;
    try {
      res = await axios.post(url, body, {
        httpsAgent: this.httpsAgent,
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      if (error.response?.status === 429) {
        this.logger.warn(`[Agones][${requestId}] 사용 가능한 GameServer 없음`);
        return null;
      }

      this.logger.error(
        `[Agones][${requestId}] allocator 요청 실패`,
        error.response?.data,
      );
      throw error;
    }

    const port = res.data?.ports?.[0]?.port;
    const externalIp = res.data?.addresses?.find(
      (a) => a.type === 'ExternalIP',
    )?.address;
    const externalDns = res.data?.addresses?.find(
      (a) => a.type === 'ExternalDNS',
    )?.address;

    const gameserverIp = externalIp ?? externalDns ?? res.data?.address;
    const gameserverName = res.data?.gameServerName;

    if (!gameserverIp || !port || !gameserverName) {
      this.logger.error(
        `[Agones][${requestId}] allocation 응답 파싱 실패`,
        JSON.stringify(res.data, null, 2),
      );
      throw new Error('Agones allocation 응답이 올바르지 않습니다');
    }

    this.logger.log(
      `[Agones][${requestId}] 할당 성공: ${gameserverName} (${gameserverIp}:${port})`,
    );

    return {
      gameserverIp,
      gameserverName,
      port,
    };
  }
}
