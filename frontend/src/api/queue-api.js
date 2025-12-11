import { MATCHING_CONFIG } from "../../config.js";

// export async function matchingQueue() {
//   const accessToken = localStorage.getItem("waguwagu_token");

//   if (!accessToken) {
//     throw new Error("액세스 토큰이 없습니다. 닉네임을 다시 입력해주세요.");
//   }
	
// 	const res = await fetch(`${MATCHING_CONFIG.MATCHING_URL}/queue`, {
// 		method: "POST",
// 		headers: {
// 			"Content-Type": "application/json",
// 			"Authorization": `Bearer ${accessToken}`,
// 		},
// 	});

// 	if (!res.ok) {
//     const errorData = await res.json();
//     const message = errorData.message || "매칭 큐 진입 실패";
//     const errorMessage = Array.isArray(message) ? message[0] : message;
//     throw new Error(errorMessage);
//   }
// 	// { message, userId }
// 	return await res.json(); 
// }


// export async function cancelQueue() {
//   const accessToken = localStorage.getItem("waguwagu_token");

// 	if (!accessToken) {
//     throw new Error("액세스 토큰이 없습니다. 닉네임을 다시 입력해주세요.");
//   }
	
// 	const res = await fetch(`${MATCHING_CONFIG.MATCHING_URL}/queue/cancel`, {
// 		method: "POST",
// 		headers: {
// 			"Content-Type": "application/json",
// 			"Authorization": `Bearer ${accessToken}`,
// 		},
// 	});

// 	if (!res.ok) {
//     const errorData = await res.json();
//     const message = errorData.message || "매칭 큐 취소 실패";
//     const errorMessage = Array.isArray(message) ? message[0] : message;
//     throw new Error(errorMessage);
//   }
// 	// { message, currentStatus }
// 	return await res.json(); 
// }


// export async function getQueueLength() {
//   const accessToken = localStorage.getItem("waguwagu_token");

// 	if (!accessToken) {
//     throw new Error("액세스 토큰이 없습니다. 닉네임을 다시 입력해주세요.");
//   }
	
// 	const res = await fetch(`${MATCHING_CONFIG.MATCHING_URL}/queue/length`, {
// 		method: "GET",
// 		headers: {
// 			"Content-Type": "application/json",
// 			"Authorization": `Bearer ${accessToken}`,
// 		},
// 	});

// 	if (!res.ok) {
//     const errorData = await res.json();
//     const message = errorData.message || "매칭 큐 길이 조회 실패";
//     const errorMessage = Array.isArray(message) ? message[0] : message;
//     throw new Error(errorMessage);
//   }
// 	// { message, currentCount, totalQueueLength }
// 	return await res.json(); 
// }
