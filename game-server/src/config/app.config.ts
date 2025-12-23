// config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  matchingPort: Number(process.env.MATCHING_PORT ?? 3000),
  gamePort: Number(process.env.GAME_PORT ?? 3001),
}));
