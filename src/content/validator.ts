// 담당: 9d10c602 — 문제 JSON 검증, 팀 등록 검증.
import type { ContentFile, ValidationIssue } from '../types';
import type { TeamDraft } from '../core/engine';

/**
 * 알 수 없는 JSON을 검증해 ContentFile로 변환.
 * 5문제·5보기, 빈 문구 금지, id 고유(세트/문제/보기 범위별), 정답 id가 보기 중 하나, 빈칸 "___" 포함.
 * 오류가 하나라도 있으면 content=null.
 */
export function parseContentFile(json: unknown): { content: ContentFile | null; issues: ValidationIssue[] } {
  void json;
  return { content: null, issues: [{ location: '전체', message: 'TODO(9d10c602)' }] };
}

/** 팀 등록 검증: 공백 이름, 중복 이름(앞뒤 공백 무시), 세트 연결 누락/존재하지 않는 세트. */
export function validateTeamDrafts(drafts: TeamDraft[], content: ContentFile): ValidationIssue[] {
  void drafts; void content;
  return [];
}
