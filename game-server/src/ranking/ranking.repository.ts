export abstract class RankingRepository {
  abstract saveScore(
    playerId: string,
    nickname: string,
    score: number,
  ): Promise<void>;
  abstract getWeeklyRanking(): Promise<
    { playerId: string; nickname: string; score: number }[]
  >;
}
