import { MATCHING_CONFIG } from "../../config.js";

// OAuth 이후 닉네임 설정 전용 함수
export async function setNickname(nickname) {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다");
  }

  const res = await fetch(`${MATCHING_CONFIG.API_BASE_URL}/auth/nickname`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ nickname }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    const message = errorData.message || "닉네임 설정 실패";
    const errorMessage = Array.isArray(message) ? message[0] : message;
    throw new Error(errorMessage);
  }

  return await res.json(); // { accessToken }
}
