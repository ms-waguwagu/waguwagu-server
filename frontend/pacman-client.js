import { GameCore } from "./src/js/game/game-core.js";
import { Renderer } from "./src/js/game/renderer.js";
import { SPAWN_POINTS } from "./src/js/game/map.js";

const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");
const mainScreen = document.getElementById("main-screen");
const gameScreen = document.getElementById("game-screen");
const myNicknameLabel = document.getElementById("my-nickname");
const roomIdLabel = document.getElementById("room-id");
const restartButton = document.getElementById("restart-button");

// 플레이어별 조작키 매핑
const PLAYER_CONTROLS = {
  player1: {
    label: "플레이어 1",
    color: "yellow",
    gridX: 1,
    gridY: 1,
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  player2: {
    label: "플레이어 2",
    color: "cyan",
    gridX: 13,
    gridY: 8,
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
  },
};

// 게임 엔진 / 렌더러 / 루프 관련 변수
let game = null;
let renderer = null;
let animationFrameId = null;

// 키보드 입력 상태 저장 객체 (누르고 있는지 true/false)
const keys = {};

// 키가 눌릴 때 실행
const handleKeyDown = (event) => {
  keys[event.code] = true;
};

// 키가 떼어질 때 실행
const handleKeyUp = (event) => {
  keys[event.code] = false;
};

// 기존 키보드 이벤트 제거 (중복 등록 방지)
const detachKeyboardHandlers = () => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
};

// 키보드 이벤트 등록
const attachKeyboardHandlers = () => {
  detachKeyboardHandlers();
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
};

// 게임 루프 (매 프레임마다 실행)
const runGameLoop = () => {
  if (!game || !renderer) return;

  // 플레이어 입력 처리
  Object.entries(PLAYER_CONTROLS).forEach(([id, ctrl]) => {
    const p = game.getState().players[id];
    if (!p) return;
    if (keys[ctrl.up]) game.processInput(id, "ArrowUp");
    else if (keys[ctrl.down]) game.processInput(id, "ArrowDown");
    else if (keys[ctrl.left]) game.processInput(id, "ArrowLeft");
    else if (keys[ctrl.right]) game.processInput(id, "ArrowRight");
  });

  // 유령 이동
  game.updateGhosts();

  // 화면 그리기
  renderer.draw(game.getState());

  if (game.getState().gameOver) {
    statusMessage.textContent = "게임 종료! 다시 시작하려면 버튼 클릭!";
    restartButton.style.display = "block";
    return;
  }

  animationFrameId = requestAnimationFrame(runGameLoop);
};

// 게임 루프 중지
const stopGameLoop = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

// 로컬 게임 시작
const startLocalGame = () => {
  stopGameLoop(); // 기존 루프 종료
  game = new GameCore();
  renderer = new Renderer("pacman-canvas");

  // 플레이어 스폰
  Object.entries(PLAYER_CONTROLS).forEach(([playerId, config]) => {
    const spawn = SPAWN_POINTS[config.spawnIndex] || { x: 1, y: 1 };
    game.addPlayer(playerId, config.color, spawn.x, spawn.y);
    console.log(`${playerId} Spawned at:`, spawn);
  });

  attachKeyboardHandlers();
  runGameLoop(); // 루프 시작

  // 10초마다 유령 1마리씩 스폰
  const ghostColors = ["red", "pink", "orange", "blue", "green"];
  let ghostIndex = 0;

  const spawnNextGhost = () => {
    if (ghostIndex >= ghostColors.length) return; // 모든 유령 스폰 완료
    const color = ghostColors[ghostIndex];
    game.addGhost(`ghost${ghostIndex + 1}`, color);
    console.log(`Ghost ${ghostIndex + 1} spawned!`);
    ghostIndex++;
    if (ghostIndex < ghostColors.length) {
      setTimeout(spawnNextGhost, 10000); // 10초 뒤 다음 유령 스폰
    }
  };

  spawnNextGhost(); // 첫 유령 스폰 시작
};

// 게임 시작 버튼 클릭 처리
startButton.addEventListener("click", () => {
  // 닉네임 입력 검사
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    statusMessage.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  // UI 업데이트
  statusMessage.textContent = "";
  myNicknameLabel.textContent = nickname;
  roomIdLabel.textContent = "DEV-ROOM";
  mainScreen.style.display = "none";
  gameScreen.style.display = "block";
  startLocalGame();
});

restartButton.addEventListener("click", () => {
  restartButton.style.display = "none";
  statusMessage.textContent = "";
  startLocalGame(); // 게임 다시 시작
});

// 페이지를 떠날 때 정리 작업
window.addEventListener("beforeunload", () => {
  stopGameLoop();
  detachKeyboardHandlers();
});
