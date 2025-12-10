// pacman-client.js

import { Renderer } from "./src/js/game/renderer.js";
import { CONFIG } from "./config.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";

// ====== 전역 상태 ======
let socket = null;
let renderer = null;
let latestGameState = null;
let animationFrameId = null;
const keys = {};

// ====== DOM 요소 ======
const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");
const mainScreen = document.getElementById("main-screen");
const gameScreen = document.getElementById("game-screen");
const myNicknameLabel = document.getElementById("my-nickname");
const roomIdLabel = document.getElementById("room-id");

// ====== 키보드 입력 상태 관리 ======
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = false;
});

// ====== WebSocket 연결 ======
function connectWebSocket(roomId, nickname) {
  socket = io(CONFIG.SOCKET_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);
    socket.emit("join-room", { roomId, nickname });
  });

  // 초기화 데이터 수신
  socket.on("init-game", (data) => {
    const { playerId, roomId, mapData, initialState } = data;
    
    console.log("Map data received from server:", mapData);
    console.log(`My ID: ${playerId}, Joined Room: ${roomId}`);

    renderer = new Renderer("pacman-canvas", mapData);
    renderer.draw(initialState);
  });

  // 게임 상태 업데이트
  socket.on("state", (serverState) => {
    const playerCount = serverState.players ? Object.keys(serverState.players).length : 0;
    const dotsCount = serverState.dots ? serverState.dots.length : 0;

    if (!serverState || playerCount === 0 || dotsCount === 0) {
      console.warn(
        `[State Warning] State is incomplete! Players: ${playerCount}, Dots: ${dotsCount}`
      );
    }

    window.gameState = serverState;
    latestGameState = serverState;

    // 게임 오버 감지
    if (serverState.gameOver && !window.__gameOverHandled) {
      window.__gameOverHandled = true;
      handleGameOver(serverState);
    }
  });
}

function onGameOver(finalScores) {
  const scoreboard = document.getElementById("scoreboard");
  const scoreEntries = document.getElementById("score-entries");
  const gameEndText = document.getElementById("game-end-text");

  // 1) 종료 텍스트 등장
  gameEndText.classList.add("show");

  // 2) 점수판 데이터 업데이트
  scoreEntries.innerHTML = "";
  finalScores.forEach((player, i) => {
    scoreEntries.innerHTML += `
      <div>
        ${i + 1}위 - ${player.nickname} : ${player.score}
      </div>
    `;
  });

  // 3) 점수판을 중앙으로 이동시키기 (애니메이션)
  scoreboard.classList.add("game-over");

  // 게임 조작 중단
  window.gameEnded = true;
}




// ====== 렌더링 루프 ======
function gameLoop() {
  if (renderer && latestGameState) {
    renderer.draw(latestGameState);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  gameLoop();
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
  }, 33);
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

  myNicknameLabel.textContent = nickname;
  const roomId = "DEV-ROOM";
  roomIdLabel.textContent = roomId;

  mainScreen.style.display = "none";
  gameScreen.style.display = "block";

  connectWebSocket(roomId, nickname);
  sendInputLoop();
  startGameLoop();
});

// ====== 게임 종료 처리 ======
function handleGameOver(state) {
  const modal = document.getElementById("game-end-modal");
  if (modal) {
    modal.classList.remove("hidden");
  }

  // 서버에서 보낸 최종 스코어 (players를 점수 순으로 정렬)
  const players = Object.values(state.players)
    .sort((a, b) => b.score - a.score);

  // onGameOver 실행
  onGameOver(players);

    setTimeout(() => {
    backToMainScreen();
  }, 5000);
}



// ====== 메인 화면으로 돌아가기 ======
function backToMainScreen() {
  const modal = document.getElementById("game-end-modal");
  if (modal) modal.classList.add("hidden");

  gameScreen.style.display = "none";
  mainScreen.style.display = "flex";

  // 종료 텍스트 숨기기
  const gameEndText = document.getElementById("game-end-text");
  if (gameEndText) gameEndText.classList.remove("show");

  // 🔥 점수판 중앙 이동 초기화
  const scoreboard = document.getElementById("scoreboard");
  if (scoreboard) scoreboard.classList.remove("game-over");

  if (socket) socket.disconnect();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  renderer = null;
  latestGameState = null;

  nicknameInput.value = "";
  statusMessage.textContent = "";

  loadRanking();
  window.__gameOverHandled = false;
}


// ====== 랭킹 로드 ======
async function loadRanking() {
  try {
    const response = await fetch(CONFIG.API_URL + "/ranking/top");
    if (!response.ok) throw new Error("Failed to fetch");

    const data = await response.json();
    const list = document.getElementById("ranking-list");

    if (!data || data.length === 0) {
      list.innerHTML = '<div class="empty-ranking">랭킹 데이터가 없습니다</div>';
      return;
    }

    list.innerHTML = data
      .map((item, index) => {
        const date = new Date(item.playedAt);
        
        const formatted =
          `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")} ` +
          `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;

        return `
        <div class="ranking-item rank-${item.rank}">
          <div class="rank">${item.rank}</div>
          <div class="nick">${item.nickname}</div>
          <div class="score">
            ${item.score}<br>
            <span style="font-size:12px; color:#999;">${formatted}</span>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    console.error("랭킹 로드 실패:", error);
    const list = document.getElementById("ranking-list");
    if (list) {
      list.innerHTML = '<div class="empty-ranking">랭킹을 불러올 수 없습니다</div>';
    }
  }
}


// ====== 페이지 떠날 때 정리 ======
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});

// ====== 초기화 ======
loadRanking(); // 페이지 로드 시 랭킹 표시
setInterval(loadRanking, 30000); // 30초마다 랭킹 갱신