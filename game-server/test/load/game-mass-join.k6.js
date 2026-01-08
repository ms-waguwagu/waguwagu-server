import ws from 'k6/ws';
import { sleep } from 'k6';

export const options = {
  scenarios: {
    room_creation_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 200 },
        { duration: '20s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
};

const ACCESS_TOKEN = __ENV.ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  throw new Error('ACCESS_TOKEN 필수');
}

export default function () {
  const url =
    `wss://matching.waguwagu.cloud/queue/socket.io/` +
    `?EIO=4&transport=websocket` +
    `&auth[token]=${encodeURIComponent(ACCESS_TOKEN)}`;

  ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      // join_queue
      socket.send(`42${JSON.stringify(['join_queue'])}`);
    });

    socket.on('message', (msg) => {
      // match_found 오면 룸 생성됨
      if (msg.includes('match_found')) {
        socket.close();
      }
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  sleep(1);
}
