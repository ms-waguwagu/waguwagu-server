import { TILE_SIZE } from "./map.js";

export function drawPlayer(ctx, player) {
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;

  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/2, 0, Math.PI * 2);
  ctx.fill();
}
