export const CONFIG = {
	// 전부 수정 필요
  API_URL: "/api/game", // NestJS REST API
  SOCKET_URL: "/api/game/game", // WebSocket 서버
  BOSS_GAME_URL: "/api/game/boss", // ‼️보스테스트‼️
};

export const MATCHING_CONFIG = {
	API_BASE_URL: "https://matching.waguwagu.cloud",

  // WebSocket (ALB 직결)
  WS_MATCHING_URL: "https://matching.waguwagu.cloud/queue",
	
  GOOGLE_CLIENT_ID:
    "154265017834-ekukrom3qijqqks90uetmptji64bhto4.apps.googleusercontent.com",
};
