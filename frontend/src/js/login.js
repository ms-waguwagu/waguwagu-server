import { setNickname } from "../api/login-api.js";
import { CONFIG } from "/config.js";

window.addEventListener("DOMContentLoaded", () => {
  const nicknameInput = document.getElementById("nickname-input");
  const startButton = document.getElementById("start-button");
  const statusMessage = document.getElementById("status-message");
  const bossStartButton = document.getElementById("boss-start-button");

  if (startButton) {
    startButton.addEventListener("click", async () => {
      const nickname = nicknameInput.value.trim();
      statusMessage.textContent = "";

      if (!nickname) {
        statusMessage.textContent = "닉네임을 입력해주세요.";
        nicknameInput.focus();
        return;
      }

      try {
        // ⭐ setNickname은 토큰을 발급받는 함수
        const { accessToken } = await setNickname(nickname);
        
        // ⭐ 발급받은 토큰 저장
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("waguwagu_nickname", nickname);
        
        // 페이지 이동
        window.location.href = "home.html";
      } catch (error) {
        console.error("로그인 에러:", error);
        statusMessage.textContent = error.message || "로그인 실패";
      }
    });
  }

  if (bossStartButton) {
    bossStartButton.addEventListener("click", async () => {
      const nickname = nicknameInput.value.trim();

      if (!nickname) {
        statusMessage.textContent = "닉네임을 입력해주세요.";
        nicknameInput.focus();
        return;
      }

      try {
        const { accessToken } = await setNickname(nickname);
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("waguwagu_nickname", nickname);
        window.location.href = "queue.html?mode=boss";
      } catch (error) {
        statusMessage.textContent =
          error.message || "보스 모드 진입 실패";
      }
    });
  }

  loadHomeRanking();
  setInterval(loadHomeRanking, 30000);
});

async function loadHomeRanking() {
  try {
    const res = await fetch(
      `${CONFIG.RANKING_API_URL}/ranking/top`,
      { cache: "no-store" } // 🔥 이 한 줄로 304 자체를 방지
    );

    if (!res.ok) {
      throw new Error("API 요청 실패");
    }

    const data = await res.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;

    if (!data || data.length === 0) {
      list.innerHTML = "<div class='empty-ranking'>데이터 없음</div>";
      return;
    }

    list.innerHTML = data
      .map(
        (item) => `
        <div class="ranking-item">
          <div class="rank">${item.rank}</div>
          <div class="nick">${item.nickname}</div>
          <div class="score">${item.score}</div>
        </div>`
      )
      .join("");
  } catch (err) {
    const list = document.getElementById("ranking-list");
    if (list) {
      list.innerHTML =
        "<div class='empty-ranking'>랭킹을 불러올 수 없습니다</div>";
    }
  }
}
