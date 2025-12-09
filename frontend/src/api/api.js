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
    throw new Error("닉네임 입력 실패");
  }

  // { message, accessToken }
	return await res.json(); 

}
