import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";

let socket = null;

export function connectSocket() {
  socket = io("http://localhost:3000/game", {
    transports: ["polling", "websocket"], // ★ 둘 다 허용해야 함
    // 또는 transports 지우고 기본값 사용도 가능
  });

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ WebSocket Error:", err);
  });

  socket.on("state", (state) => {
    window.gameState = state;
  });
}

export function sendInput(dir) {
  if (!socket) return;
  socket.emit("input", { dir });
}
