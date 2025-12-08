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

// 플레이어별 조작키 매핑
// 동적 위치 할당으로 수정해야함!
const PLAYER_CONTROLS = {
  player1: {
    label: "플레이어 1",
    color: "yellow",
    // gridX: 1,
    // gridY: 1,
    spawnIndex: 0, // 첫 번째 'S' 위치 사용
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  player2: {
    label: "플레이어 2",
    color: "cyan",
    // gridX: 13,
    // gridY: 8,
    spawnIndex: 1, // 두 번째 'S' 위치 사용
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

  // 플레이어별 조작키에 따라 게임 엔진에 입력 전달
  Object.entries(PLAYER_CONTROLS).forEach(([playerId, controls]) => {
    if (!game.getState().players[playerId]) return;

    // 한 번에 하나의 방향만 처리해서 대각선 입력 막기
    if (keys[controls.up]) {
      game.processInput(playerId, "ArrowUp");
    } else if (keys[controls.down]) {
      game.processInput(playerId, "ArrowDown");
    } else if (keys[controls.left]) {
      game.processInput(playerId, "ArrowLeft");
    } else if (keys[controls.right]) {
      game.processInput(playerId, "ArrowRight");
    }
  });

  // 현재 게임 상태를 화면에 그림
  renderer.draw(game.getState());
  // 다음 프레임 예약
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
  stopGameLoop();
  game = new GameCore();
  renderer = new Renderer("pacman-canvas");

  Object.entries(PLAYER_CONTROLS).forEach(([playerId, config]) => {
    // 맵 파일에서 파싱된 스폰 좌표 가져오기
    // 만약 스폰 포인트가 부족하면 기본값(1,1) 사용 (에러 방지)
    const spawn = SPAWN_POINTS[config.spawnIndex] || { x: 1, y: 1 };
    game.addPlayer(playerId, config.color, spawn.x, spawn.y);
    console.log(`${playerId} Spawned at:`, spawn); // 디버깅용 로그
  });
  attachKeyboardHandlers();
  runGameLoop();
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

// 페이지를 떠날 때 정리 작업
window.addEventListener("beforeunload", () => {
  stopGameLoop();
  detachKeyboardHandlers();
});
