import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const API_BASE_URL = __ENV.API_BASE_URL;
const WS_BASE_URL = __ENV.WS_BASE_URL;
const GOOGLE_ID_TOKEN = __ENV.GOOGLE_ID_TOKEN;

export default function () {
  /* ===============================
   * 1️. Google 로그인
   * =============================== */
  const loginRes = http.post(
    `${API_BASE_URL}/auth/google`,
    JSON.stringify({ idToken: GOOGLE_ID_TOKEN }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'google login success': (r) => r.status === 200 || r.status === 201,
    'accessToken exists': (r) => !!r.json('accessToken'),
  });

  const accessToken = loginRes.json('accessToken');
  if (!accessToken) return;

  /* ===============================
   * 2️. WebSocket 큐 진입
   * =============================== */
  const url = `${WS_BASE_URL}/queue`;

  ws.connect(
    url,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    function (socket) {
      socket.on('open', () => {
        // 각 VU당 딱 한 번만 큐 진입
        if (__ITER === 0) {
          socket.emit('join_queue');
        }
      });

      socket.on('message', (data) => {
        const msg = JSON.parse(data);

        if (msg.event === 'queue_joined') {
          check(msg, {
            'queue join success': () => true,
          });
          socket.close();
        }
      });

      socket.on('error', (e) => {
        console.error('WS error', e);
      });

      socket.on('close', () => {
        // 연결 종료
      });
    }
  );

  sleep(1);
}
