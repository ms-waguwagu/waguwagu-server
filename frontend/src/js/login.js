import { setNickname } from "../api/login-api.js";
import { CONFIG } from "../../config.js"; 

const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");

// ⚠️ 중요: HTML에 'boss-start-button' 아이디를 가진 버튼이 없으면 에러가 날 수 있습니다.
// 만약 보스 버튼을 안 만드셨다면 아래 bossStartButton 관련 코드는 주석 처리하거나 지워야 합니다.
const bossStartButton = document.getElementById("boss-start-button");

// 1. 게임 시작 버튼 이벤트
startButton.addEventListener("click", async () => {
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

    console.log("닉네임 설정 & 토큰 교체 완료:", nickname);
    window.location.href = "home.html";
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

// 2. 랭킹 로드 함수 (디자인 연결 수정됨 ✨)
async function loadHomeRanking() {
  try {
    const res = await fetch(CONFIG.API_URL + "/ranking/top");
    if (!res.ok) throw new Error("API 요청 실패");

    const data = await res.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;

    if (!data || data.length === 0) {
      list.innerHTML = "<div class='empty-ranking'>데이터가 없습니다</div>";
      return;
    }

    list.innerHTML = data
      .map((item) => {
        const date = new Date(item.playedAt);

        // 날짜 포맷 (MM-DD HH:mm)
        const formattedTime =
          `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
            date.getDate()
          ).padStart(2, "0")} ` +
          `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
          ).padStart(2, "0")}`;

        // 🔥 여기가 핵심 수정 포인트! 🔥
        // 1) class="time" -> class="played-at" (CSS랑 맞춤)
        // 2) item.score -> item.score.toLocaleString() (1,500 처럼 콤마 찍기)
        return `
          <div class="ranking-item">
            <div class="rank">${item.rank}</div>
            <div class="nick" title="${item.nickname}">${item.nickname}</div>
            <div class="score-wrapper">
              <div class="score">${item.score.toLocaleString()}</div>
              <div class="played-at">${formattedTime}</div>
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

// 3. 보스전 시작 버튼 이벤트 (버튼이 있을 때만 실행)
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
      console.error(error);
      statusMessage.textContent = error.message || "보스 모드 진입 실패";
    }
  });
}

// 페이지 로드 시 실행
loadHomeRanking();
setInterval(loadHomeRanking, 30000);