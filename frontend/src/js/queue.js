


import { getQueueLength, cancelQueue } from "../api/queue-api.js";

// DOM 요소 가져오기
const timerEl = document.getElementById("queue-timer");
const cancelBtn = document.getElementById("cancel-queue-btn");
const currentQueueCountEl = document.getElementById("current-queue-count");
const maxQueueCountEl = document.getElementById("max-queue-count");

let seconds = 0;
let timerInterval = null;
let statusInterval = null;

const LIMIT_SECONDS = 30;

function formatTime(sec) {
  const s = String(sec % 60).padStart(2, "0");
  return `0:${s}`;
}

// 타이머 시작
function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
		 // 30초 도달 → 타이머 중단 
    if (seconds >= LIMIT_SECONDS) {
      stopTimer();
    }
  }, 1000);
}

// 타이머 중단
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 대기열 상태 업데이트 (폴링)
async function updateQueueStatus() {
  try {
    const data = await getQueueLength();
    
    // 현재 매칭 그룹 내 인원수 표시
    if (currentQueueCountEl) {
      currentQueueCountEl.textContent = data.currentCount;
			console.log("현재 대기 인원수", data.currentCount);
    }
    
    // 필요하다면 totalQueueLength도 활용 가능
    // console.log(`Queue Status: ${data.currentCount} / 5 (Total: ${data.totalQueueLength})`);

  } catch (error) {
    console.error("대기열 상태 업데이트 실패:", error);
    window.location.href = "login.html";
  }
}

// 대기 취소 → 로그인 페이지로 이동
cancelBtn.addEventListener("click", async () => {
  stopTimer();
  if (statusInterval) clearInterval(statusInterval);

  try {
    await cancelQueue();
    console.log("대기열 취소 성공");
  } catch (error) {
    console.error("대기열 취소 실패:", error);
    alert("대기열 취소 중 오류가 발생했습니다.");
  } finally {
    window.location.href = "login.html";
  }
});

// 페이지 로드 시 자동 실행
startTimer();
updateQueueStatus(); // 즉시 1회 실행
statusInterval = setInterval(updateQueueStatus, 3000); // 3초마다 갱신
