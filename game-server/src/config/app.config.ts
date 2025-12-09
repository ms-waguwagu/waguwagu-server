import { registerAs } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export default registerAs('app', () => ({
  matchingPort: parseInt(process.env.MATCHING_PORT ?? '3000', 10),
  gamePort: parseInt(process.env.GAME_PORT ?? '3001', 10),
  socketUrl: process.env.SOCKET_URL ?? 'http://localhost:3001/game',
}));
