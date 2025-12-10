import { loginNickname } from "../api/api.js";
// import { ErrorHandler } from "../error/ErrorHandler.js";

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

    // 게임 페이지(index.html)로 이동
    window.location.href = "game.html";
  } catch (error) {
    // ErrorHandler.handleError(error, "Login");
    statusMessage.textContent = error.message;
  }
});
