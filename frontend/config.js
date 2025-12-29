export const MATCHING_CONFIG = {
  API_BASE_URL: "https://matching.waguwagu.cloud",
  WS_BASE_URL: "wss://matching.waguwagu.cloud",

  GOOGLE_CLIENT_ID:
    "154265017834-ekukrom3qijqqks90uetmptji64bhto4.apps.googleusercontent.com",
};

export const CONFIG = {
  API_URL: `${MATCHING_CONFIG.API_BASE_URL}/api/game`,
  SOCKET_URL: `${MATCHING_CONFIG.WS_BASE_URL}/api/game/game`,
  BOSS_GAME_URL: `${MATCHING_CONFIG.API_BASE_URL}/api/game/boss`,
  WS_MATCHING_URL: `${MATCHING_CONFIG.WS_BASE_URL}/queue`,
};
