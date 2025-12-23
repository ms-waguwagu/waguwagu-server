// agones-test.service.ts
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AgonesTestService {
	constructor() {}
  async testAllocate() {
    const agent = new https.Agent({
    cert: fs.readFileSync('/etc/agones/allocator/client/tls.crt'),
    key: fs.readFileSync('/etc/agones/allocator/client/tls.key'),
    ca: fs.readFileSync('/etc/agones/allocator/ca/tls-ca.crt'),

    // CN/SAN 문제 회피
    checkServerIdentity: () => undefined,
  });

  const res = await axios.post(
    'https://k8s-agonessy-agonesal-8cd89d81e1-1ac91e2f2467bc6b.elb.ap-northeast-2.amazonaws.com/gameserverallocation',
    {
      namespace: 'game', // GameServer가 있는 네임스페이스
    },
    {
      httpsAgent: agent,
      timeout: 5000,
    },
  );

  return res.data;
  }
}
