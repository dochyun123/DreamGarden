// 담당: dream-20 — localStorage 자동 저장, 버전 확인, 초기화.
import { SCHEMA_VERSION } from '../types';
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

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function createGameStorage(backend?: Storage, key = 'malsseum-quiz/v1'): GameStorage {
  // localStorage 접근 자체가 막힌 환경(보안 설정 등)도 있으므로 사용 시점에 가져온다.
  const store = (): Storage => {
    if (backend) return backend;
    try {
      return window.localStorage;
    } catch (e) {
      throw new StorageError('브라우저 저장소를 사용할 수 없습니다.', { cause: e });
    }
  };

  return {
    load() {
      let raw: string | null;
      try {
        raw = store().getItem(key);
      } catch (e) {
        return { kind: 'incompatible', reason: `저장소를 읽을 수 없습니다: ${errorText(e)}` };
      }
      if (raw === null) return { kind: 'empty' };

      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return { kind: 'incompatible', reason: '저장된 데이터가 손상되어 읽을 수 없습니다.' };
      }
      if (!isObject(data)) return { kind: 'incompatible', reason: '저장된 데이터 형식이 올바르지 않습니다.' };
      if (data.schemaVersion !== SCHEMA_VERSION) {
        return {
          kind: 'incompatible',
          reason: `저장 형식 버전이 다릅니다 (저장됨: ${String(data.schemaVersion)}, 현재: ${SCHEMA_VERSION}).`,
        };
      }
      const missing = shapeProblem(data);
      if (missing) return { kind: 'incompatible', reason: `저장된 데이터에 ${missing}` };
      return { kind: 'ok', state: data as unknown as GameState };
    },

    save(state) {
      let raw: string;
      try {
        raw = JSON.stringify(state);
      } catch (e) {
        throw new StorageError(`게임 상태를 저장 형식으로 바꾸지 못했습니다: ${errorText(e)}`, { cause: e });
      }
      try {
        store().setItem(key, raw);
      } catch (e) {
        if (e instanceof StorageError) throw e;
        throw new StorageError(`게임 상태를 저장하지 못했습니다 (저장 공간 부족 등): ${errorText(e)}`, { cause: e });
      }
    },

    clear() {
      try {
        store().removeItem(key);
      } catch (e) {
        if (e instanceof StorageError) throw e;
        throw new StorageError(`저장된 데이터를 지우지 못했습니다: ${errorText(e)}`, { cause: e });
      }
    },
  };
}

/** GameState 최상위 필드 형태 확인. 문제가 있으면 설명, 없으면 null. */
function shapeProblem(d: Record<string, unknown>): string | null {
  if (typeof d.contentVersion !== 'string') return 'contentVersion이 없습니다.';
  for (const field of ['questionSets', 'teams', 'results', 'undoHistory'] as const) {
    if (!Array.isArray(d[field])) return `${field} 목록이 없습니다.`;
  }
  if (d.progress !== null && !isObject(d.progress)) return 'progress 형식이 올바르지 않습니다.';
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
