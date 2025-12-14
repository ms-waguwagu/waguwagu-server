import { Renderer } from "../game/renderer.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";
import { CONFIG } from "../../config.js";

export class GameManager {
  constructor({
    nickname,
    roomId,
    token,
    socketUrl,
    gameScreen,
    gameEndModal,
    homeButton,
    finalScoreList,
  }) {
    this.nickname = nickname;
    this.roomId = roomId;
    this.token = token;
    this.socketUrl = socketUrl;

    // DOM Elements
    this.gameScreen = gameScreen;
    this.gameEndModal = gameEndModal;
    this.homeButton = homeButton;
    this.finalScoreList = finalScoreList;

    // Game State
    this.socket = null;
    this.renderer = null;
    this.latestGameState = null;
    this.animationFrameId = null;
    this.inputLoopInterval = null;
    this.keys = {};

    // Flags
    this.gameOverHandled = false;

    this.setupEventListeners();
  }

  showQueueScreen() {
    // 1. UI 표시
    document.getElementById("main-screen").style.display = "none";
    document.getElementById("queue-screen").style.display = "block";

    // 2. 대기열 로직 초기화 (소켓 전달)
    this.cleanupQueue = initQueueScreen(this.socket, (matchData) => {
      // 매칭 성공 시 실행될 콜백
      console.log("매칭 잡힘! 게임 서버로 이동합니다:", matchData);

      // 대기열 화면 숨기기
      document.getElementById("queue-screen").style.display = "none";

      // 3. 게임 서버로 접속 (Handoff)
      this.connectToGameServer(matchData);
    });
  }

  setupEventListeners() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));

    if (this.homeButton) {
      this.homeButton.addEventListener("click", () => {
        this.stop();
        window.location.href = "login.html";
      });
    }
  }

  handleKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys[e.code] = true;
  }

  handleKeyUp(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys[e.code] = false;
  }

  connectWebSocket() {
    this.socket = io(this.socketUrl, {
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("🟢 Connected:", this.socket.id);
      this.socket.emit("join-room", {
        roomId: this.roomId,
        nickname: this.nickname,
      });
    });

    this.socket.on("init-game", (data) => {
      const { playerId, roomId, mapData, initialState } = data;
      console.log("Map data received:", mapData);
      console.log(`My ID: ${playerId}, Joined Room: ${roomId}`);

      this.renderer = new Renderer("pacman-canvas", mapData);
      this.renderer.draw(initialState);
    });

// ============================
// 카운트다운 이벤트 처리
// ============================
this.socket.on("countdown", ({ count }) => {
  const el = document.getElementById("countdown-display");

  if (!el) return;

  if (count > 0) {
    el.style.display = "block";
    el.textContent = count;
    el.classList.add("pop");   // 애니메이션
    setTimeout(() => el.classList.remove("pop"), 350);
  } else {
    el.textContent = "START!";
    el.classList.add("start");
    setTimeout(() => {
      el.style.display = "none";
      el.classList.remove("start");
    }, 900);
  }

  // 카운트다운 동안 입력 막기
  window.isCountdownActive = count > 0;
});


    this.socket.on("state", (serverState) => {
      if (!serverState) return;
			
			// ‼️보스 테스트‼️
			console.log("🔥 state.boss:", serverState.boss);

      // 타이머 갱신 코드 추가
      const timerEl = document.getElementById("game-timer");
      if (timerEl && typeof serverState.remainingTime === "number") {
        const sec = Math.ceil(serverState.remainingTime / 1000);
        timerEl.textContent = `남은 시간: ${sec}초`;
      }

      const playerCount = serverState.players
        ? Object.keys(serverState.players).length
        : 0;
      const dotsCount = serverState.dots ? serverState.dots.length : 0;

      if (playerCount === 0 || dotsCount === 0) {
        console.warn(
          `[State Warning] State is incomplete! Players: ${playerCount}, Dots: ${dotsCount}`
        );
      }

      if (serverState.gameOver && !this.gameOverHandled) {
        this.gameOverHandled = true;
        this.showGameEndModal(serverState);
      }

      this.latestGameState = serverState;
    });

    this.socket.on("game-over", (data) => {
      console.log("🔥 GAME OVER EVENT RECEIVED", data);

      if (this.gameOverHandled) return;

      this.gameOverHandled = true;
      this.showGameEndModal({
        players: data.players,
        botPlayers: data.botPlayers,
        gameOverReason: data.reason,
      });
    });
  }

  showGameEndModal(state) {
    // 1. 점수판 업데이트
    const scoreEntries = document.getElementById("score-entries");
    if (scoreEntries && state.players) {
      const allPlayers = [
        ...Object.values(state.players || {}), // 일반 플레이어
        ...(state.botPlayers || []), // 봇 플레이어는 배열이므로 그대로 펼치기
      ];
      console.log("🏆 GAME OVER - 최종 점수 확인:", allPlayers);

      const players = allPlayers.sort((a, b) => b.score - a.score);

      scoreEntries.innerHTML = "";
      players.forEach((player, i) => {
        scoreEntries.innerHTML += `
              <div>
                ${i + 1}위 - ${player.nickname} : ${player.score}
              </div>
            `;
      });
    }

    // 2. 점수판 중앙 이동 애니메이션
    const scoreboard = document.getElementById("scoreboard");
    if (scoreboard) {
      scoreboard.classList.add("game-over");
    }

    // 3. 종료 텍스트 (옵션)
    const gameEndText = document.getElementById("game-end-text");
    if (gameEndText) {
      gameEndText.classList.add("show");
    }

    // 4. 모달 표시 (기존 로직 유지)
    if (this.gameEndModal) {
      this.gameEndModal.classList.remove("hidden");

      let html = "<ul>";
      const allPlayers = [
        ...Object.values(state.players || {}),
        ...(state.botPlayers || []),
      ];
      const players = allPlayers
        .filter((p) => p.score !== undefined) // 혹시 score 없는 항목 필터
        .sort((a, b) => b.score - a.score);

      for (const p of players) {
        html += `<li>${p.nickname} : ${p.score}점</li>`;
      }
      html += "</ul>";

      if (state.gameOverReason) {
        html += `<p>종료 사유: ${state.gameOverReason}</p>`;
      }

      if (this.finalScoreList) {
        this.finalScoreList.innerHTML = html;
      }
    }

    // 5초 후 메인으로 자동 이동
    setTimeout(() => {
      this.stop();
      window.location.href = "login.html";
    }, 5000);
  }

  async loadRanking() {
    try {
      const response = await fetch(CONFIG.API_URL + "/ranking/top");
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      const list = document.getElementById("ranking-list");

      if (!list) return; // 요소가 없으면 중단

      if (!data || data.length === 0) {
        list.innerHTML =
          '<div class="empty-ranking">랭킹 데이터가 없습니다</div>';
        return;
      }

      list.innerHTML = data
        .map((item, index) => {
          const date = new Date(item.playedAt);
          const formatted =
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(date.getDate()).padStart(2, "0")} ` +
            `${String(date.getHours()).padStart(2, "0")}:${String(
              date.getMinutes()
            ).padStart(2, "0")}`;

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
        list.innerHTML =
          '<div class="empty-ranking">랭킹을 불러올 수 없습니다</div>';
      }
    }
  }

  gameLoop() {
    if (this.renderer && this.latestGameState) {
      this.renderer.draw(this.latestGameState);
    }
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  startInputLoop() {
    this.inputLoopInterval = setInterval(() => {
  if (!this.socket) return;

  // 카운트다운 중이면 입력 무시
  if (window.isCountdownActive) return;

  const dir = { dx: 0, dy: 0 };
  if (this.keys["ArrowUp"]) dir.dy = -1;
  else if (this.keys["ArrowDown"]) dir.dy = 1;
  else if (this.keys["ArrowLeft"]) dir.dx = -1;
  else if (this.keys["ArrowRight"]) dir.dx = 1;

  this.socket.emit("input", { dir });
}, 33);

  }

  start() {
    this.connectWebSocket();
    this.gameLoop();
    this.startInputLoop();
    this.loadRanking(); // 랭킹 로드 (요소가 있으면 표시됨)
    setInterval(() => this.loadRanking(), 30000);
  }

  stop() {
    if (this.socket) this.socket.disconnect();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.inputLoopInterval) clearInterval(this.inputLoopInterval);

    // UI Cleanup
    const scoreboard = document.getElementById("scoreboard");
    if (scoreboard) scoreboard.classList.remove("game-over");

    const gameEndText = document.getElementById("game-end-text");
    if (gameEndText) gameEndText.classList.remove("show");

    if (this.gameEndModal) this.gameEndModal.classList.add("hidden");

    this.gameOverHandled = false;
  }
}
