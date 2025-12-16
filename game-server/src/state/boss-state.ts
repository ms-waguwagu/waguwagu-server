export interface BossState {
  roomId: string;

  x: number;
  y: number;

  // 이동 방향 (AI 서버에서 예측하거나 내부적으로 결정)
  dir: { dx: number; dy: number };

  speed: number;

  // 보스 패턴/행동 모드
  phase: number; // 예: 1페이즈 도망/추적, 2페 강공격 등

  // 실제 크기
  size: number; // 컬리전 계산용
}
