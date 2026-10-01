// 담당: 9d10c602 — localStorage 자동 저장, 버전 확인, 초기화.
import type { GameState } from '../types';

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: GameState }
  | { kind: 'incompatible'; reason: string }; // schemaVersion 불일치·파싱 실패

export interface GameStorage {
  load(): LoadResult;
  /** 실패 시 StorageError throw (용량 초과 등). 앱이 진행을 멈추고 관리 화면에 알린다. */
  save(state: GameState): void;
  clear(): void;
}

export class StorageError extends Error {}

export function createGameStorage(backend?: Storage, key = 'malsseum-quiz/v1'): GameStorage {
  void backend; void key;
  throw new Error('TODO(9d10c602)');
}
