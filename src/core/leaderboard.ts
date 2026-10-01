// 담당: dream-20
import type { GameState, LeaderboardRow } from '../types';

/** 완료 팀만, 통과 수 내림차순. 공동 순위(5,5,3,0 → 1,1,2,3). 동점은 팀 등록 순서. */
export function computeLeaderboard(state: GameState): LeaderboardRow[] {
  const rows = state.teams
    .map((team, order) => ({ team, order, result: state.results.find((r) => r.teamId === team.id) }))
    .filter((x) => x.team.status === 'completed' && x.result)
    .sort((a, b) => b.result!.passedCount - a.result!.passedCount || a.order - b.order);

  let rank = 0;
  let prevScore: number | null = null;
  return rows.map(({ team, result }) => {
    if (result!.passedCount !== prevScore) {
      rank += 1;
      prevScore = result!.passedCount;
    }
    return {
      rank,
      teamId: team.id,
      teamName: team.name,
      passedCount: result!.passedCount,
      cleared: result!.outcome === 'clear',
    };
  });
}
