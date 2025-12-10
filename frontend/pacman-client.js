import { CONFIG } from "./config.js";
import { GameManager } from "./src/js/game.js";

// ====== 초기화 및 인증 체크 ======
const token = localStorage.getItem("waguwagu_token");
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
const roomId = "DEV-ROOM"; // 일단 하드코딩
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
  finalScoreList
});

gameManager.start();

// ====== 페이지 떠날 때 정리 ======
window.addEventListener("beforeunload", () => {
  gameManager.stop();
  
  // ❌게임 상태 업데이트❌
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

    // ❌게임 오버 감지❌
    if (serverState.gameOver && !window.__gameOverHandled) {
      window.__gameOverHandled = true;
      handleGameOver(serverState);
    }
  });
}
//❌
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
  //❌여기까지 수정필요
  
    // ❌서버에서 보낸 최종 스코어 (players를 점수 순으로 정렬)
  const players = Object.values(state.players)
    .sort((a, b) => b.score - a.score);

  // onGameOver 실행
  onGameOver(players);

    setTimeout(() => {
    backToMainScreen();
  }, 5000);
// ❌여기까지 수정 필요
}

// =❌===== 메인 화면으로 돌아가기 ======
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
//❌ 여기까지 수정 필요

});

// ====== 초기화 ======
loadRanking(); // 페이지 로드 시 랭킹 표시
setInterval(loadRanking, 30000); // 30초마다 랭킹 갱신