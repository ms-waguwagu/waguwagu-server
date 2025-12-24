// frontend/src/utils/config.js
import { ENV } from "./env.js";

export const CONFIG = {
  API_URL: ENV.API_URL,
  SOCKET_URL: `${ENV.SOCKET_URL}/game`,     // 게임 소켓 네임스페이스
  BOSS_GAME_URL: `${ENV.SOCKET_URL}/boss`, // 보스 소켓 네임스페이스
};

export const MATCHING_CONFIG = {
  GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID,
  
  // 👇 [필수] 이 줄을 추가해야 로그인 API가 작동합니다!
  MATCHING_URL: ENV.MATCHING_URL, 
};