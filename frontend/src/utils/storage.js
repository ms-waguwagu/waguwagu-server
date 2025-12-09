export function saveToken(token) {
  localStorage.setItem("accessToken", token);
}

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function clearToken() {
  localStorage.removeItem("accessToken");
}
