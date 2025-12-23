import { ENV } from "./env.js";

export const CONFIG = {
  API_URL: ENV.API_URL,
  SOCKET_URL: `${ENV.SOCKET_URL}/game`,
  BOSS_GAME_URL: `${ENV.SOCKET_URL}/boss`,
};

export const MATCHING_CONFIG = {
  GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID,
};
