// 담당: dream-20
import type { GameState, LeaderboardRow } from '../types';

/** 완료 팀만, 통과 수 내림차순. 공동 순위(5,5,3,0 → 1,1,2,3). 동점은 팀 등록 순서. */
export function computeLeaderboard(state: GameState): LeaderboardRow[] {
  void state;
  return [];
}
