import { CONFIG } from "./config.js";
import { GameManager } from "./src/js/game.js";

// ====== 초기화 및 인증 체크 ======
const token = localStorage.getItem("accessToken");
const nickname = localStorage.getItem("waguwagu_nickname");

if (!token || !nickname) {
  alert("닉네임을 입력해주세요.");
  window.location.href = "src/pages/login.html";
}

// ====== DOM 요소 ======
const gameScreen = document.getElementById("game-screen");
const myNicknameLabel = document.getElementById("my-nickname");
const roomIdLabel = document.getElementById("room-id");
const homeButton = document.getElementById("home-btn");
const gameEndModal = document.getElementById("game-end-modal");
const finalScoreList = document.getElementById("final-score-list");

// UI 초기화
myNicknameLabel.textContent = nickname;
const roomId = localStorage.getItem("waguwagu_room_id");
roomIdLabel.textContent = roomId;

// ====== 게임 매니저 시작 ======
const gameManager = new GameManager({
  nickname,
  roomId,
  token,
  socketUrl: CONFIG.SOCKET_URL,
  gameScreen,
  gameEndModal,
  homeButton,
  finalScoreList,
  mode: "NORMAL",
});

gameManager.start();

// ====== 페이지 떠날 때 정리 ======
window.addEventListener("beforeunload", () => {
  gameManager.stop();
});
