/* eslint-disable prettier/prettier */
export interface PlayerState {
    id: string;                
    x: number;                 
    y: number;                 
    dir: { dx: number; dy: number };
    color: string;             
    score: number;             
    nickname: string;          

    // ⭐ 신규 추가 — 스턴 기능 관련 필드
    stunned: boolean;           // 현재 스턴 상태인지 여부
    stunEndTime: number;        // 스턴 해제 시간 (timestamp)
    alpha: number;              // 렌더링 투명도 (1.0 또는 0.4)
}
