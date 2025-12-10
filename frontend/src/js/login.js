import { loginNickname } from "../api/login-api.js";
import { matchingQueue } from "../api/queue-api.js";

const nicknameInput = document.getElementById("nickname-input");
const startButton = document.getElementById("start-button");
const statusMessage = document.getElementById("status-message");

startButton.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    statusMessage.textContent = "닉네임을 입력해주세요.";
    nicknameInput.focus();
    return;
  }

  try {
    const { accessToken } = await loginNickname(nickname);

    // 토큰과 닉네임을 localStorage에 저장
    localStorage.setItem("waguwagu_token", accessToken);
    localStorage.setItem("waguwagu_nickname", nickname);

    console.log("토큰/닉네임 저장 완료:", accessToken, nickname);

    // 매칭 큐 진입
    await matchingQueue();
    console.log("매칭 큐 진입 성공");

    window.location.href = "queue.html";
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});
