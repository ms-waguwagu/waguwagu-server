import { setNickname } from "../api/login-api.js";
import { CONFIG } from "../utils/config.js";
console.log("API_URL =", CONFIG.API_URL);
// import { matchingQueue } from "../api/queue-api.js";

const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");
const bossStartButton = document.getElementById("boss-start-button");

startButton.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    statusMessage.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  try {
    // 닉네임 설정
    const { accessToken } = await setNickname(nickname);

    // OAuth 토큰을 새 토큰으로 교체
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("waguwagu_nickname", nickname);

    console.log("닉네임 설정 & 토큰 교체 완료:", nickname);

    // 매칭 큐 페이지로 이동
    window.location.href = "queue.html";
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

async function loadHomeRanking() {
  try {
    const res = await fetch(CONFIG.API_URL + "/ranking");
    if (!res.ok) throw new Error("API 요청 실패");

    const data = await res.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;

    if (!data || data.length === 0) {
      list.innerHTML = "<div class='empty-ranking'>데이터 없음</div>";
      return;
    }

    list.innerHTML = data
      .map((item) => {
        const date = new Date(item.playedAt);

        // 초 제거 (HH:mm)
        const formattedTime =
          `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
            date.getDate()
          ).padStart(2, "0")} ` +
          `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
          ).padStart(2, "0")}`;

        return `
          <div class="ranking-item rank-${item.rank}">
            <div class="rank">${item.rank}</div>

            <div class="nick">${item.nickname}</div>

            <div class="score-wrapper">
              <div class="score">${item.score}</div>
              <div class="time">${formattedTime}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("홈 랭킹 로드 실패:", err);
    const list = document.getElementById("ranking-list");
    if (list) {
      list.innerHTML =
        "<div class='empty-ranking'>랭킹을 불러올 수 없습니다</div>";
    }
  }
}
// ============================
// ‼️보스 테스트‼️
// ============================
bossStartButton.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    statusMessage.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  try {
    // 닉네임 설정 (일반 게임 시작과 동일)
    const { accessToken } = await setNickname(nickname);

    // OAuth 토큰을 새 토큰으로 교체
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("waguwagu_nickname", nickname);

    // 보스 모드 큐 페이지로 이동
    window.location.href = "queue.html?mode=boss";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = error.message || "보스 모드 진입 실패";
  }
});

// 페이지 로드 시 TOP10 표시
loadHomeRanking();

// 30초마다 자동 갱신
setInterval(loadHomeRanking, 30000);
