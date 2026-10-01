import { describe, expect, it } from 'vitest';
import type { GameState, Outcome, TeamStatus } from '../types';
import { computeLeaderboard } from './leaderboard';

function stateWith(entries: Array<[name: string, status: TeamStatus, passed?: number]>): GameState {
  return {
    schemaVersion: 1,
    contentVersion: 't',
    questionSets: [],
    teams: entries.map(([name, status], i) => ({ id: `team-${i + 1}`, name, questionSetId: 'set-1', status })),
    progress: null,
    results: entries.flatMap(([, status, passed], i) =>
      status === 'completed'
        ? [{
            teamId: `team-${i + 1}`,
            passedCount: passed!,
            outcome: (passed === 5 ? 'clear' : 'failed') as Outcome,
            completedAt: new Date(2026, 9, 1, 12, 10 - i).toISOString(),
          }]
        : []),
    undoHistory: [],
  };
}

describe('computeLeaderboard', () => {
  it('5,5,3,0 → 1,1,2,3 (공동 순위, 다음 점수는 다음 순위)', () => {
    const rows = computeLeaderboard(stateWith([
      ['A', 'completed', 3], ['B', 'completed', 5], ['C', 'completed', 0], ['D', 'completed', 5],
    ]));
    expect(rows.map((r) => [r.teamName, r.rank, r.passedCount, r.cleared])).toEqual([
      ['B', 1, 5, true], ['D', 1, 5, true], ['A', 2, 3, false], ['C', 3, 0, false],
    ]);
  });

  it('완료 팀만 포함한다', () => {
    const rows = computeLeaderboard(stateWith([
      ['A', 'notStarted'], ['B', 'completed', 2], ['C', 'inProgress'],
    ]));
    expect(rows).toEqual([{ rank: 1, teamId: 'team-2', teamName: 'B', passedCount: 2, cleared: false }]);
  });

  it('동점은 완료 시각이 아니라 팀 등록 순서', () => {
    const rows = computeLeaderboard(stateWith([
      ['A', 'completed', 4], ['B', 'completed', 4], ['C', 'completed', 4],
    ]));
    expect(rows.map((r) => r.teamName)).toEqual(['A', 'B', 'C']);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });

  it('완료 팀이 없으면 빈 배열', () => {
    expect(computeLeaderboard(stateWith([['A', 'notStarted']]))).toEqual([]);
  });
});
