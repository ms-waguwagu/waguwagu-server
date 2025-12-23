// DOM 요소 가져오기
const timerEl = document.getElementById("queue-timer");
const cancelBtn = document.getElementById("cancel-queue-btn");
const currentQueueCountEl = document.getElementById("current-queue-count");
// const maxQueueCountEl = document.getElementById("max-queue-count"); // 필요 시 사용

let seconds = 0;
let timerInterval = null;

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
    // 30초 도달 시 봇 투입 로직은 매칭 워커가 처리해야 함
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

export function initQueueScreen(socket, onMatchFound) {
  if (!socket) {
    console.error("소켓이 연결되지 않았습니다.");
    return;
  }

  // 1. 타이머 UI 시작
  startTimer();

  // 2. 초기 대기열 상태 요청 (화면 켜지자마자 1회 조회)
  socket.emit("request_queue_status");

  // ========== 소켓 이벤트 핸들러 함수 정의 ==========

  // A. 대기열 상태 업데이트
  const onQueueStatus = (data) => {
    // data: { currentCount, totalQueueLength }
    if (currentQueueCountEl) {
      currentQueueCountEl.textContent = data.currentCount;

      // 애니메이션 효과
      currentQueueCountEl.classList.remove("pop");
      void currentQueueCountEl.offsetWidth; // trigger reflow
      currentQueueCountEl.classList.add("pop");
    }
    //‼️테스트 용‼️
    console.log(`현재 인원: ${data.currentCount}/5`);
  };

  // B. 대기열 취소 성공 응답
  const onQueueCancelled = (data) => {
    console.log(data.message);
    stopTimer();
    removeListeners(); // 리스너 정리
    window.location.href = "login.html"; // 로그인 화면으로 이동
  };

  // C. 에러 처리
  const onError = (data) => {
    alert(data.message || "오류가 발생했습니다.");
    stopTimer();
    removeListeners();
    window.location.href = "login.html";
  };

  // D. 매칭 성사
  const onMatchFoundEvent = (data) => {
    console.log("🎉 매칭 성공!", data);
    stopTimer();
    removeListeners(); // 대기열 관련 리스너 정리

    // 매칭 성공 콜백 실행 (게임 화면으로 전환 & 접속 Handoff)
    if (onMatchFound) {
      onMatchFound(data);
    }
  };

  // -------- 소켓 이벤트 리스너 등록 --------
  socket.on("queue_status", onQueueStatus);
  socket.on("queue_cancelled", onQueueCancelled);
  socket.on("error", onError);
  socket.on("match_found", onMatchFoundEvent);

  // -------- 버튼 이벤트 설정 --------
  const handleCancel = () => {
    // 버튼 중복 클릭 방지 및 UI 피드백
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "취소 중...";
    }
    socket.emit("cancel_queue");
    // 실제 이동은 'queue_cancelled' 이벤트를 수신했을 때 수행
  };

  if (cancelBtn) {
    cancelBtn.addEventListener("click", handleCancel);
  }

  // 리스너 정리 함수 (화면을 떠날 때 / 매칭 완료 시 호출)
  function removeListeners() {
    socket.off("queue_status", onQueueStatus);
    socket.off("queue_cancelled", onQueueCancelled);
    socket.off("error", onError);
    socket.off("match_found", onMatchFoundEvent);

    if (cancelBtn) {
      cancelBtn.removeEventListener("click", handleCancel);
      cancelBtn.disabled = false;
      cancelBtn.textContent = "대기 취소"; // 텍스트 원복
    }
  }

  // 외부에서 원하면 쓸 수 있게 반환 (안 써도 됨)
  return removeListeners;
}

// 페이지 로드 시 자동 실행 (queue.html에서 실행될 경우)
if (document.getElementById("queue-screen")) {
  const token = localStorage.getItem("accessToken");

  if (token) {
    if (typeof io !== "undefined") {
      const MATCHING_SERVER_URL = window.__ENV__.API_BASE_URL;

      const socket = io(`${MATCHING_SERVER_URL}/queue`, {
        auth: { token },
      });      

      // 소켓 연결되면 대기열 진입
      socket.on("connect", () => {
        console.log("queue socket connected:", socket.id);
        socket.emit("join_queue"); // 여기서 서버로 대기열 입장 요청
      });

      initQueueScreen(socket, (matchData) => {
        // 서버에서 만든 room_id를 localStorage에 저장
        localStorage.setItem("waguwagu_room_id", matchData.roomId);
        window.location.href = "game.html";
      });
    } else {
      console.error("Socket.io 라이브러리가 로드되지 않았습니다.");
    }
  } else {
    alert("닉네임 입력이 필요합니다.");
    window.location.href = "login.html";
  }
}
