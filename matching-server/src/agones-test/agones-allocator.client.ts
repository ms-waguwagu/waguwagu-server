import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import https from 'https';
import fs from 'fs';

type AllocateResult = {
  gameServerName: string;
  address: string;
  ports: { name: string; port: number }[];
  nodeName?: string;
};

export function createAllocatorAxios() {
  const allocatorHost = process.env.AGONES_ALLOCATOR_HOST!; 
  const allocatorPort = process.env.AGONES_ALLOCATOR_PORT ?? '443';

  const certPath = process.env.AGONES_CLIENT_CERT_PATH ?? '/etc/agones/allocator/client/tls.crt';
  const keyPath  = process.env.AGONES_CLIENT_KEY_PATH  ?? '/etc/agones/allocator/client/tls.key';
  const caPath   = process.env.AGONES_CA_CERT_PATH     ?? '/etc/agones/allocator/ca/tls-ca.crt';

  const agent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    ca: fs.readFileSync(caPath),

    // 체인 검증은 ca로 하고, 호스트네임 매칭만 스킵
    checkServerIdentity: () => undefined,
  });

  const baseURL = `https://${allocatorHost}:${allocatorPort}`;

  return axios.create({
    baseURL,
    httpsAgent: agent,
    headers: { 'Content-Type': 'application/json' },
    timeout: 5_000,
  });
}

export async function allocateGameServer(params: {
  namespace: string;        
  fleetName: string;        
  roomId: string;
  users: string[];
  maxPlayers: number;
  botCount: number;
}): Promise<AllocateResult> {
  const api = createAllocatorAxios();

  const body: any = {
    namespace: params.namespace,

    // selector: Fleet 지정 
    required: {
      matchLabels: {
        'agones.dev/fleet': params.fleetName,
      },
    },

    // metadata: GameServer에 room 정보 심기 (선택)
    metadata: {
      annotations: {
        'waguwagu.dev/roomId': params.roomId,
        'waguwagu.dev/usersJson': JSON.stringify(params.users),
        'waguwagu.dev/maxPlayers': String(params.maxPlayers),
        'waguwagu.dev/botCount': String(params.botCount),
      },
    },
  };

  const res = await api.post<AllocateResult>('/gameserverallocation', body);
  return res.data;
}
