// boss-game.js

import { GameManager } from "./game.js"; 
import { CONFIG } from "../../config.js";

// ---------------------------------------------
// 1) URL에서 roomId 가져오기
// 예: boss-game.html?roomId=abcd-efgh
// ---------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");

if (!roomId) {
  alert("roomId가 없습니다. /boss/debug-room API를 통해 생성해 주세요.");
  throw new Error("roomId missing");
}

// ---------------------------------------------
// 2) nickname 가져오기
//    - 로그인 여부 상관없이 localStorage에 저장된 닉네임 사용
// ---------------------------------------------
const nickname = localStorage.getItem("waguwagu_nickname");
if (!nickname) {
  alert("닉네임이 없습니다. 로그인 화면에서 닉네임을 입력해주세요.");
  window.location.href = "login.html";
}
console.log("보스 roomId:", roomId, "닉네임:", nickname);


// ---------------------------------------------
// 3) DOM Selectors
// ---------------------------------------------
const canvasScreen = document.getElementById("game-screen");
const modal = document.getElementById("game-end-modal");
const homeButton = document.getElementById("home-btn");
const finalScoreList = document.getElementById("final-score-list");

// ---------------------------------------------
// 4) GameManager 생성
// ---------------------------------------------
const manager = new GameManager({
  nickname,
  roomId,
  token: null, // 보스 디버그 모드는 토큰 사용 안 함
  socketUrl: CONFIG.SOCKET_URL,
  gameScreen: canvasScreen,
  gameEndModal: modal,
  homeButton,
  finalScoreList,
  mode: 'BOSS',
});

// ---------------------------------------------
// 5) 화면 표시
// ---------------------------------------------
document.getElementById("my-nickname").textContent = nickname;
document.getElementById("room-id").textContent = roomId;

// ---------------------------------------------
// 6) 게임 시작
// ---------------------------------------------
manager.start();

console.log("🔥 Boss Mode Started");
console.log("roomId:", roomId, "nickname:", nickname);
