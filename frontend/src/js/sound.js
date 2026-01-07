export class SoundManager {
  constructor() {
    this.start = new Audio("/assets/sounds/start.mp3");
    this.start.volume = 0.6;
  }

  playStart() {
    this.start.currentTime = 0;
    this.start.play().catch(() => {});
  }
}
