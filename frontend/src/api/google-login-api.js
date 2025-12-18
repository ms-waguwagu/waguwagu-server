import { MATCHING_CONFIG } from "../../config.js";

export async function googleLogin(idToken) {
  const res = await fetch(
    `${MATCHING_CONFIG.MATCHING_URL}/auth/google`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "구글 로그인 실패");
  }

  return await res.json(); 
  // { accessToken, isNewUser }
}
