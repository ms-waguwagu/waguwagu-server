import { Renderer } from "../game/renderer.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";

export class GameManager {
  constructor({ nickname, roomId, token, socketUrl, gameScreen, gameEndModal, homeButton, finalScoreList }) {
    this.nickname = nickname;
    this.roomId = roomId;
    this.token = token;
    this.socketUrl = socketUrl;

    // DOM Elements
    this.gameScreen = gameScreen;
    this.gameEndModal = gameEndModal;
    this.homeButton = homeButton;
    this.finalScoreList = finalScoreList;

    // Game State
    this.socket = null;
    this.renderer = null;
    this.latestGameState = null;
    this.animationFrameId = null;
    this.inputLoopInterval = null;
    this.keys = {};

    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));

    if (this.homeButton) {
      this.homeButton.addEventListener("click", () => {
        this.stop();
        window.location.href = "login.html";
      });
    }
  }

  handleKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys[e.code] = true;
  }

  handleKeyUp(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys[e.code] = false;
  }

  connectWebSocket() {
    this.socket = io(this.socketUrl, {
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("🟢 Connected:", this.socket.id);
      this.socket.emit("join-room", { roomId: this.roomId, nickname: this.nickname });
    });

    this.socket.on("init-game", (data) => {
      const { playerId, roomId, mapData, initialState } = data;
      console.log("Map data received:", mapData);
      console.log(`My ID: ${playerId}, Joined Room: ${roomId}`);

      this.renderer = new Renderer("pacman-canvas", mapData);
      this.renderer.draw(initialState);
    });

    this.socket.on("state", (serverState) => {
      if (!serverState) return;

      if (serverState.gameOver) {
        this.showGameEndModal(serverState);
      }

      this.latestGameState = serverState;
    });
  }

  showGameEndModal() {
    if (this.gameEndModal) {
      this.gameEndModal.classList.remove("hidden");
    }
  }

  gameLoop() {
    if (this.renderer && this.latestGameState) {
      this.renderer.draw(this.latestGameState);
    }
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  startInputLoop() {
    this.inputLoopInterval = setInterval(() => {
      if (!this.socket) return;

      const dir = { dx: 0, dy: 0 };
      if (this.keys["ArrowUp"]) dir.dy = -1;
      else if (this.keys["ArrowDown"]) dir.dy = 1;
      else if (this.keys["ArrowLeft"]) dir.dx = -1;
      else if (this.keys["ArrowRight"]) dir.dx = 1;

      this.socket.emit("input", { dir });
    }, 33);
  }

  start() {
    this.connectWebSocket();
    this.gameLoop();
    this.startInputLoop();
  }

  stop() {
    if (this.socket) this.socket.disconnect();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.inputLoopInterval) clearInterval(this.inputLoopInterval);
  }
}
