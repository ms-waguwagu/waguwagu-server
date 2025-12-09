// pacman-client.js

import { Renderer } from "./src/js/game/renderer.js";
import { CONFIG } from "./config.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";

// ====== 전역 상태 ======
let socket = null;
let renderer = null;
let latestGameState = null; 
let animationFrameId = null; // 루프 ID 저장용 

const keys = {};

// ====== DOM 요소 ======
const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");
const mainScreen = document.getElementById("main-screen");
const gameScreen = document.getElementById("game-screen");
const myNicknameLabel = document.getElementById("my-nickname");
const roomIdLabel = document.getElementById("room-id");
const restartButton = document.getElementById("restart-btn");

// (점수판 / 모달 DOM은 나중에 서버가 점수/게임종료를 줄 때 다시 붙이자)

// ====== 키보드 입력 상태 관리 ======
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

export function connectSocket() {
  socket = io(CONFIG.SOCKET_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);
  });

  socket.on("state", (state) => {
    window.gameState = state;
  });
}

// ====== WebSocket 연결 ======
function connectWebSocket(roomId, nickname) {
  socket = io(CONFIG.SOCKET_URL, {
    transports: ["websocket"], // websocket만 사용 권장
  });

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);

    // 방 입장 요청 (B단계에서 만든 join-room 기반)
    socket.emit("join-room", { roomId, nickname });
  });

  // 서버가 방 입장 완료 알림
	socket.on("init-game", (data) => {
    const { playerId, roomId, mapData, initialState } = data;
    
    console.log("Map data received from server:", mapData);
    console.log(`My ID: ${playerId}, Joined Room: ${roomId}`);

    // 서버에서 받은 맵 데이터로 렌더러 생성
    renderer = new Renderer("pacman-canvas", mapData);
    
    // 초기 상태 한번 그려주기
    renderer.draw(initialState);
		
  });

  // 서버에서 현재 상태 내려줌 (players 객체)
  socket.on("state", (serverState) => {

		const playerCount = serverState.players ? Object.keys(serverState.players).length : 0;
  const dotsCount = serverState.dots ? serverState.dots.length : 0;

  if (!serverState || playerCount === 0 || dotsCount === 0) {
    console.warn(
      `[State Warning] State is incomplete! Players: ${playerCount}, Dots: ${dotsCount}`
    );
  } else {
   
  }
    window.gameState = serverState; // 전역 변수 업데이트 (디버깅용)
    latestGameState = serverState;  // 렌더링용 변수 업데이트
  });
}

// ====== 렌더링 루프 ======
function gameLoop() {
  if (renderer && latestGameState) {
    renderer.draw(latestGameState);
  }
	// 다음 프레임 예약 및 ID 저장
  animationFrameId = requestAnimationFrame(gameLoop);
}

// 2. 루프 시작/정지 헬퍼
function startGameLoop() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId); // 기존 루프 중지
  gameLoop(); // 새 루프 시작
}

// 게임 루프 시작
startGameLoop();

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

  // 서버 WebSocket 연결 + 입력 전송 시작
  connectWebSocket(roomId, nickname);
  sendInputLoop();
});

// ====== 페이지 떠날 때 정리 ======
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});

restartButton.addEventListener("click", () => {
  restartButton.style.display = "none";
  statusMessage.textContent = "";
  mainScreen.style.display = "block";
  gameScreen.style.display = "none";
});

// 페이지를 떠날 때 정리 작업
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});
