// 담당: dream-20 — 문제 JSON 검증, 팀 등록 검증.
import { CHOICES_PER_QUESTION, QUESTIONS_PER_SET } from '../types';
import type { Choice, ContentFile, Question, QuestionSet, ValidationIssue } from '../types';
import type { TeamDraft } from '../core/engine';

const BLANK_PATTERN = /_{3,}/;

/**
 * 알 수 없는 JSON을 검증해 ContentFile로 변환.
 * 5문제·5보기, 빈 문구 금지, id 고유(세트/문제/보기 범위별), 정답 id가 보기 중 하나, 빈칸 "___" 포함.
 * 오류가 하나라도 있으면 content=null.
 */
export function parseContentFile(json: unknown): { content: ContentFile | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (location: string, message: string) => issues.push({ location, message });

  if (!isObject(json)) {
    add('전체', '문제 파일이 JSON 객체가 아닙니다.');
    return { content: null, issues };
  }
  if (!isNonEmptyString(json.contentVersion)) add('전체', 'contentVersion(문제 데이터 버전)이 비어 있습니다.');
  if (!Array.isArray(json.questionSets) || json.questionSets.length === 0) {
    add('전체', 'questionSets(문제 세트 목록)가 없거나 비어 있습니다.');
    return { content: null, issues };
  }

  const setIds = new Set<string>();
  const questionSets: QuestionSet[] = json.questionSets.map((rawSet, si) => {
    const setLoc = isObject(rawSet) && isNonEmptyString(rawSet.id) ? `세트 ${rawSet.id}` : `세트 ${si + 1}번째`;
    if (!isObject(rawSet)) {
      add(setLoc, '문제 세트 형식이 올바르지 않습니다.');
      return emptySet();
    }
    const id = requireText(rawSet.id, setLoc, '세트 id', add);
    if (id && setIds.has(id)) add(setLoc, `세트 id "${id}"가 중복됩니다.`);
    setIds.add(id);
    const scriptureReference = requireText(rawSet.scriptureReference, setLoc, '말씀 출처(scriptureReference)', add);
    const scriptureText = requireText(rawSet.scriptureText, setLoc, '말씀 원문(scriptureText)', add);

    if (!Array.isArray(rawSet.questions)) {
      add(setLoc, '문제 목록(questions)이 없습니다.');
      return { id, scriptureReference, scriptureText, questions: [] };
    }
    if (rawSet.questions.length !== QUESTIONS_PER_SET) {
      add(setLoc, `문제가 ${QUESTIONS_PER_SET}개여야 하는데 ${rawSet.questions.length}개입니다.`);
    }
    const questionIds = new Set<string>();
    const questions = rawSet.questions.map((rawQ, qi) =>
      parseQuestion(rawQ, `${setLoc} > 문제 ${qi + 1}`, questionIds, add));
    return { id, scriptureReference, scriptureText, questions };
  });

  if (issues.length > 0) return { content: null, issues };
  return { content: { contentVersion: (json.contentVersion as string).trim(), questionSets }, issues };
}

/** 팀 등록 검증: 공백 이름, 중복 이름(앞뒤 공백 무시), 세트 연결 누락/존재하지 않는 세트. */
export function validateTeamDrafts(drafts: TeamDraft[], content: ContentFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (drafts.length === 0) issues.push({ location: '팀 등록', message: '팀을 1개 이상 등록해야 합니다.' });

  const setIds = new Set(content.questionSets.map((s) => s.id));
  const seen = new Map<string, number>();
  drafts.forEach((draft, i) => {
    const name = draft.name.trim();
    const location = name ? `팀 ${i + 1}번(${name})` : `팀 ${i + 1}번`;
    if (!name) {
      issues.push({ location, message: '팀 이름이 비어 있습니다.' });
    } else if (seen.has(name)) {
      issues.push({ location, message: `팀 ${seen.get(name)! + 1}번과 이름이 같습니다.` });
    } else {
      seen.set(name, i);
    }
    if (!draft.questionSetId) {
      issues.push({ location, message: '문제 세트가 연결되지 않았습니다.' });
    } else if (!setIds.has(draft.questionSetId)) {
      issues.push({ location, message: `문제 세트 "${draft.questionSetId}"가 존재하지 않습니다.` });
    }
  });
  return issues;
}

// ───────── 내부 도우미 ─────────

type AddIssue = (location: string, message: string) => void;

function parseQuestion(raw: unknown, loc: string, questionIds: Set<string>, add: AddIssue): Question {
  if (!isObject(raw)) {
    add(loc, '문제 형식이 올바르지 않습니다.');
    return { id: '', prompt: '', choices: [], correctChoiceId: '' };
  }
  const id = requireText(raw.id, loc, '문제 id', add);
  if (id && questionIds.has(id)) add(loc, `문제 id "${id}"가 세트 안에서 중복됩니다.`);
  questionIds.add(id);

  const prompt = requireText(raw.prompt, loc, '질문(prompt)', add);
  if (prompt && !BLANK_PATTERN.test(prompt)) add(loc, '질문에 빈칸 표시(밑줄 3개 이상 "___")가 없습니다.');

  let choices: Choice[] = [];
  if (!Array.isArray(raw.choices)) {
    add(loc, '보기 목록(choices)이 없습니다.');
  } else {
    if (raw.choices.length !== CHOICES_PER_QUESTION) {
      add(loc, `보기가 ${CHOICES_PER_QUESTION}개여야 하는데 ${raw.choices.length}개입니다.`);
    }
    const choiceIds = new Set<string>();
    choices = raw.choices.map((rawC, ci) => {
      const cLoc = `${loc} > 보기 ${ci + 1}`;
      if (!isObject(rawC)) {
        add(cLoc, '보기 형식이 올바르지 않습니다.');
        return { id: '', text: '' };
      }
      const cid = requireText(rawC.id, cLoc, '보기 id', add);
      if (cid && choiceIds.has(cid)) add(cLoc, `보기 id "${cid}"가 문제 안에서 중복됩니다.`);
      choiceIds.add(cid);
      const text = requireText(rawC.text, cLoc, '보기 문구(text)', add);
      return { id: cid, text };
    });
  }

  const correctChoiceId = requireText(raw.correctChoiceId, loc, '정답 id(correctChoiceId)', add);
  if (correctChoiceId && choices.length > 0 && !choices.some((c) => c.id === correctChoiceId)) {
    add(loc, `정답 id "${correctChoiceId}"가 보기 중에 없습니다.`);
  }
  return { id, prompt, choices, correctChoiceId };
}

/** 비어 있지 않은 문자열이면 그대로 반환, 아니면 오류를 남기고 '' 반환. */
function requireText(value: unknown, loc: string, field: string, add: AddIssue): string {
  if (typeof value !== 'string') {
    add(loc, `${field}이(가) 없거나 문자열이 아닙니다.`);
    return '';
  }
  if (!value.trim()) {
    add(loc, `${field}이(가) 비어 있습니다.`);
    return '';
  }
  return value;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function emptySet(): QuestionSet {
  return { id: '', scriptureReference: '', scriptureText: '', questions: [] };
}
