import { describe, expect, it } from 'vitest';
import sample from '../../data/sample-content.json';
import type { ContentFile, GameState } from '../types';
import {
  completeAnimation, createInitialState, getCurrentQuestion, registerTeams, resetRecords,
  resumeRun, selectChoice, selectTrack, startChallenge, undo,
} from '../core/engine';
import { createGameStorage, StorageError } from './storage';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

function gameState(): GameState {
  return registerTeams(createInitialState(sample as ContentFile), [
    { name: '믿음팀' },
    { name: '소망팀' },
  ]);
}

describe('GameStorage', () => {
  it('저장 전에는 empty, 저장 후 같은 상태를 읽는다', () => {
    const storage = createGameStorage(memoryStorage());
    expect(storage.load()).toEqual({ kind: 'empty' });
    const s = selectTrack(startChallenge(gameState(), 'team-1'), 'set-1');
    storage.save(s);
    expect(storage.load()).toEqual({ kind: 'ok', state: s });
  });

  it('clear 후 empty', () => {
    const storage = createGameStorage(memoryStorage());
    storage.save(gameState());
    storage.clear();
    expect(storage.load()).toEqual({ kind: 'empty' });
  });

  it('키를 분리해 사용한다', () => {
    const backend = memoryStorage();
    createGameStorage(backend, 'a').save(gameState());
    expect(createGameStorage(backend, 'b').load()).toEqual({ kind: 'empty' });
  });

  it('손상된 JSON → incompatible', () => {
    const backend = memoryStorage();
    backend.setItem('k', '{not json');
    const r = createGameStorage(backend, 'k').load();
    expect(r.kind).toBe('incompatible');
  });

  it('다른 schemaVersion → incompatible (이유에 버전 표시)', () => {
    const backend = memoryStorage();
    backend.setItem('k', JSON.stringify({ ...gameState(), schemaVersion: 999 }));
    const r = createGameStorage(backend, 'k').load();
    expect(r).toEqual({ kind: 'incompatible', reason: expect.stringContaining('999') });
  });

  it('필수 필드가 없거나 객체가 아니면 incompatible', () => {
    const backend = memoryStorage();
    const storage = createGameStorage(backend, 'k');
    backend.setItem('k', JSON.stringify({ schemaVersion: 1, contentVersion: 'x' }));
    expect(storage.load().kind).toBe('incompatible');
    backend.setItem('k', '[1]');
    expect(storage.load().kind).toBe('incompatible');
  });

  it('save 실패(용량 초과 등) → StorageError로 감싸 throw', () => {
    const backend = memoryStorage();
    backend.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    const storage = createGameStorage(backend);
    expect(() => storage.save(gameState())).toThrow(StorageError);
    try {
      storage.save(gameState());
    } catch (e) {
      expect((e as StorageError).cause).toBeInstanceOf(DOMException);
    }
  });

  it('읽기 실패는 throw 없이 incompatible', () => {
    const backend = memoryStorage();
    backend.getItem = () => { throw new Error('denied'); };
    expect(createGameStorage(backend).load().kind).toBe('incompatible');
  });

  it('backend 생략 시 window.localStorage 사용', () => {
    window.localStorage.clear();
    const storage = createGameStorage(undefined, 'test-key');
    storage.save(gameState());
    expect(window.localStorage.getItem('test-key')).not.toBeNull();
    storage.clear();
    expect(window.localStorage.getItem('test-key')).toBeNull();
  });
});

describe('저장과 엔진 연동 (기획서 8장)', () => {
  const correct = (s: GameState) => getCurrentQuestion(s)!.correctChoiceId;
  const wrong = (s: GameState) => {
    const q = getCurrentQuestion(s)!;
    return q.choices.find((c) => c.id !== q.correctChoiceId)!.id;
  };

  it('연출 중 새로고침 → 로드 후 resumeRun 해도 점수·목숨·기록 중복 없음', () => {
    const storage = createGameStorage(memoryStorage());
    let s = selectTrack(startChallenge(gameState(), 'team-1'), 'set-1');
    for (let i = 0; i < 4; i++) {
      s = selectChoice(s, correct(s));
      s = completeAnimation(s, s.progress!.runId);
    }
    s = selectChoice(s, correct(s)); // 마지막 정답, 정답 연출 중
    storage.save(s);
    const staleRun = s.progress!.runId;

    const loaded = storage.load();
    if (loaded.kind !== 'ok') throw new Error('load failed');
    let r = resumeRun(loaded.state);
    expect(completeAnimation(r, staleRun)).toBe(r);
    expect(r.progress).toMatchObject({ passedCount: 5, lives: 3, phase: 'correct' });
    r = completeAnimation(r, r.progress!.runId);
    storage.save(r); // heaven 연출 중 저장 후 다시 새로고침
    const again = storage.load();
    if (again.kind !== 'ok') throw new Error('load failed');
    r = resumeRun(again.state);
    r = completeAnimation(r, r.progress!.runId);
    expect(r.progress).toBeNull();
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({ teamId: 'team-1', passedCount: 5, outcome: 'clear' });
  });

  it('Undo 복원 상태도 저장 후 유지, 전체 초기화는 팀명 유지·고른 말씀 해제', () => {
    const storage = createGameStorage(memoryStorage());
    let s = selectTrack(startChallenge(gameState(), 'team-1'), 'set-1');
    s = selectChoice(s, wrong(s));
    s = undo(s);
    storage.save(s);
    const loaded = storage.load();
    if (loaded.kind !== 'ok') throw new Error('load failed');
    expect(loaded.state.progress).toMatchObject({ lives: 3, phase: 'awaitingAnswer' });
    expect(loaded.state.undoHistory).toHaveLength(2); // 도전 시작, 말씀 선택

    const reset = resetRecords(loaded.state);
    storage.save(reset);
    const after = storage.load();
    if (after.kind !== 'ok') throw new Error('load failed');
    expect(after.state.teams.map((t) => [t.name, t.questionSetId, t.status])).toEqual([
      ['믿음팀', null, 'notStarted'], ['소망팀', null, 'notStarted'],
    ]);
    expect(after.state.progress).toBeNull();
    expect(after.state.results).toEqual([]);
    expect(after.state.undoHistory).toEqual([]);
  });
});
