// pacman-client.js

import { Renderer } from "./src/js/game/renderer.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";

// ====== 전역 상태 ======
let socket = null;
let renderer = null;
let myPlayerId = null;

const keys = {};

// ====== DOM 요소 ======
const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");
const mainScreen = document.getElementById("main-screen");
const gameScreen = document.getElementById("game-screen");
const myNicknameLabel = document.getElementById("my-nickname");
const roomIdLabel = document.getElementById("room-id");

// (점수판 / 모달 DOM은 나중에 서버가 점수/게임종료를 줄 때 다시 붙이자)


// ====== 키보드 입력 상태 관리 ======
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});


// ====== WebSocket 연결 ======
function connectWebSocket(roomId, nickname) {
socket = io("http://localhost:3000/game", {
  transports: ["polling", "websocket"],
});

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);

    // 방 입장 요청 (B단계에서 만든 join-room 기반)
    socket.emit("join-room", { roomId, nickname });
  });

  // 서버가 방 입장 완료 알려줌
  socket.on("joined", ({ playerId, roomId }) => {
    myPlayerId = playerId;
    roomIdLabel.textContent = roomId;
    console.log("🎮 Joined room:", roomId, "my ID:", playerId);
  });

  // 서버에서 현재 상태 내려줌 (players 객체)
  socket.on("state", (serverState) => {
  if (!renderer) return;
  renderer.draw(serverState);
  });
}


// ====== 입력 전송 루프 (30FPS) ======
function sendInputLoop() {
  setInterval(() => {
    if (!socket) return;

    const dir = { dx: 0, dy: 0 };

    if (keys["ArrowUp"]) dir.dy = -1;
    else if (keys["ArrowDown"]) dir.dy = 1;
    else if (keys["ArrowLeft"]) dir.dx = -1;
    else if (keys["ArrowRight"]) dir.dx = 1;

    socket.emit("input", { dir });
  }, 33); // ≒ 30FPS
}


// ====== 게임 시작 버튼 처리 ======
startButton.addEventListener("click", () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    statusMessage.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  statusMessage.textContent = "";

  // UI 전환
  myNicknameLabel.textContent = nickname;
  const roomId = "DEV-ROOM"; // 일단 하드코딩, 나중에 매칭 서버랑 연동
  roomIdLabel.textContent = roomId;

  mainScreen.style.display = "none";
  gameScreen.style.display = "block";

  // 캔버스 렌더러 생성
  renderer = new Renderer("pacman-canvas");

  // 서버 WebSocket 연결 + 입력 전송 시작
  connectWebSocket(roomId, nickname);
  sendInputLoop();
});


// ====== 페이지 떠날 때 정리 ======
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});
