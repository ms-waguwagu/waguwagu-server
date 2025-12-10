import { MATCHING_CONFIG } from "../../config.js";

export async function loginNickname(nickname) {
  const res = await fetch(`${MATCHING_CONFIG.MATCHING_URL}/auth/nickname`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    const message = errorData.message || "닉네임 입력 실패";
		// 매칭서버에서 validation error가 배열로 반환됨
		const errorMessage = Array.isArray(message) ? message[0] : message;
    throw new Error(errorMessage);
  }

  // { message, accessToken }
	return await res.json(); 

}
