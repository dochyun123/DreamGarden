// 담당: dream-20 — 스프레드시트(구글 시트·엑셀)에서 내보낸 CSV를 ContentFile로 변환.
// 한 행 = 문제 하나. 변환 후 parseContentFile로 검증하고, 오류 위치는 CSV 행 번호로 알려준다.
import { CHOICES_PER_QUESTION, QUESTIONS_PER_SET } from '../types';
import type { ContentFile, Question, QuestionSet, ValidationIssue } from '../types';
import { parseContentFile } from './validator';

const COLUMNS = {
  setId: '세트ID',
  reference: '말씀 출처',
  text: '말씀 원문',
  number: '문제 번호',
  prompt: '문제',
  choices: Array.from({ length: CHOICES_PER_QUESTION }, (_, i) => `보기${i + 1}`),
  answer: '정답 번호',
} as const;

const HEADER_ROW = 1;

interface CsvRecord {
  /** 스프레드시트 행 번호 (헤더 = 1) */
  row: number;
  cells: string[];
}

interface QuestionRow {
  row: number;
  number: number | null;
  prompt: string;
  choices: string[];
  answer: number | null;
}

/**
 * CSV 문자열 → ContentFile.
 * 헤더: 세트ID, 말씀 출처, 말씀 원문, 문제 번호, 문제, 보기1~보기5, 정답 번호 (열 순서 무관, 칸 이름의 공백 무시).
 * 말씀 출처·원문은 세트의 첫 행에만 적어도 된다. 문제 순서는 '문제 번호'로 정렬한다.
 * 오류가 하나라도 있으면 content=null.
 */
export function parseContentCsv(text: string): { content: ContentFile | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (location: string, message: string) => issues.push({ location, message });
  const fail = () => ({ content: null, issues });

  const parsed = parseCsv(text.replace(/^﻿/, ''));
  if (parsed.unterminatedQuoteRow !== null) {
    add(`${parsed.unterminatedQuoteRow}행`, '큰따옴표(")가 닫히지 않았습니다. 문구 안의 큰따옴표는 두 번("") 적어야 합니다.');
    return fail();
  }
  const [header, ...records] = parsed.records;
  if (!header || header.cells.every((c) => c.trim() === '')) {
    add('전체', 'CSV 파일이 비어 있습니다.');
    return fail();
  }

  // ── 헤더 ──
  const normalize = (s: string) => s.replace(/\s+/g, '');
  const headerIndex = new Map(header.cells.map((c, i) => [normalize(c), i] as const));
  const col = (name: string) => headerIndex.get(normalize(name)) ?? -1;
  const required = [COLUMNS.setId, COLUMNS.reference, COLUMNS.text, COLUMNS.number, COLUMNS.prompt, ...COLUMNS.choices, COLUMNS.answer];
  const missing = required.filter((name) => col(name) < 0);
  if (missing.length > 0) {
    const garbled = header.cells.join('').includes('�');
    add(`${HEADER_ROW}행(헤더)`, garbled
      ? '글자가 깨져 있습니다. 엑셀에서는 "CSV UTF-8(쉼표로 분리)" 형식으로 저장해 주세요.'
      : `필요한 칸이 없습니다: ${missing.join(', ')}. 템플릿의 첫 행을 그대로 사용해 주세요.`);
    return fail();
  }
  const width = header.cells.length;

  // ── 행 → 문제 ──
  const sets = new Map<string, { reference: string; text: string; rows: QuestionRow[] }>();

  for (const record of records) {
    const cell = (name: string) => (record.cells[col(name)] ?? '').trim();
    if (record.cells.every((c) => c.trim() === '')) continue; // 빈 행 무시
    const loc = `${record.row}행`;

    if (record.cells.slice(width).some((c) => c.trim() !== '')) {
      add(loc, '칸 수가 헤더보다 많습니다. 쉼표가 들어간 문구는 큰따옴표로 감싸야 합니다.');
    }

    const setId = cell(COLUMNS.setId);
    if (!setId) {
      add(loc, '세트ID가 비어 있습니다.');
      continue;
    }
    let set = sets.get(setId);
    if (!set) {
      set = { reference: '', text: '', rows: [] };
      sets.set(setId, set);
    }
    const setLoc = `${loc}(세트 ${setId})`;
    for (const [key, name] of [['reference', COLUMNS.reference], ['text', COLUMNS.text]] as const) {
      const value = cell(name);
      if (!value) continue;
      if (!set[key]) set[key] = value;
      else if (set[key] !== value) add(setLoc, `${name}이(가) 이 세트의 앞 행과 다릅니다. 세트의 첫 행에만 적거나 똑같이 적어 주세요.`);
    }

    const number = parseNumberCell(cell(COLUMNS.number), QUESTIONS_PER_SET);
    if (number === null) add(setLoc, `문제 번호는 1~${QUESTIONS_PER_SET} 사이 숫자여야 합니다. (현재: "${cell(COLUMNS.number)}")`);
    else if (set.rows.some((r) => r.number === number)) {
      const dup = set.rows.find((r) => r.number === number)!;
      add(setLoc, `문제 번호 ${number}이(가) ${dup.row}행과 중복됩니다.`);
    }
    const answer = parseNumberCell(cell(COLUMNS.answer), CHOICES_PER_QUESTION);
    if (answer === null) add(setLoc, `정답 번호는 1~${CHOICES_PER_QUESTION} 사이 숫자여야 합니다. (현재: "${cell(COLUMNS.answer)}")`);

    const row: QuestionRow = {
      row: record.row,
      number,
      prompt: cell(COLUMNS.prompt),
      choices: COLUMNS.choices.map(cell),
      answer,
    };
    set.rows.push(row);
  }

  if (sets.size === 0 && issues.length === 0) {
    add('전체', '문제 행이 없습니다. 헤더 아래에 문제를 한 행에 하나씩 적어 주세요.');
  }
  if (issues.length > 0) return fail();

  // ── ContentFile 구성 ──
  const questionSets: QuestionSet[] = [...sets].map(([setId, set]) => {
    set.rows.sort((a, b) => a.number! - b.number!);
    return {
      id: setId,
      scriptureReference: set.reference,
      scriptureText: set.text,
      questions: set.rows.map((r): Question => {
        const qid = `${setId}-q${r.number}`;
        const choices = r.choices.map((text, k) => ({ id: `${qid}-c${k + 1}`, text }));
        return { id: qid, prompt: r.prompt, choices, correctChoiceId: choices[r.answer! - 1].id };
      }),
    };
  });
  const json: ContentFile = { contentVersion: `csv-${new Date().toISOString()}`, questionSets };

  // ── 검증 + 위치를 CSV 행 번호로 바꾸기 ──
  const result = parseContentFile(json);
  if (result.issues.length === 0) return result;
  return {
    content: null,
    issues: result.issues.map((issue) => ({ ...issue, location: toCsvLocation(issue.location, sets) })),
  };
}

/** "세트 set-1 > 문제 2 > 보기 4" → "3행(세트 set-1 문제 2) 보기4 칸" */
function toCsvLocation(
  location: string,
  sets: Map<string, { rows: QuestionRow[] }>,
): string {
  const m = /^세트 (.+?)(?: > 문제 (\d+))?(?: > 보기 (\d+))?$/.exec(location);
  const set = m && sets.get(m[1]);
  if (!m || !set) return location;
  if (!m[2]) {
    const rowNums = set.rows.map((r) => r.row);
    return `${Math.min(...rowNums)}~${Math.max(...rowNums)}행(세트 ${m[1]})`;
  }
  const row = set.rows[Number(m[2]) - 1];
  if (!row) return location;
  const base = `${row.row}행(세트 ${m[1]} 문제 ${row.number})`;
  return m[3] ? `${base} 보기${m[3]} 칸` : base;
}

/** "3", " 3 ", "3번" → 3. 범위 밖이거나 숫자가 아니면 null */
function parseNumberCell(value: string, max: number): number | null {
  const m = /^(\d+)\s*번?$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

/**
 * RFC 4180 파서. 따옴표 안의 쉼표·줄바꿈, "" 이스케이프, CRLF/LF/CR 줄바꿈 처리.
 * 따옴표 밖의 따옴표는 글자 그대로 둔다(관대한 처리).
 */
export function parseCsv(text: string): { records: CsvRecord[]; unterminatedQuoteRow: number | null } {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoteStartRow = 0;
  let row = 1;

  const endField = () => { cells.push(field); field = ''; };
  const endRecord = () => {
    endField();
    records.push({ row, cells });
    cells = [];
    row += 1;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        field += '\n'; i++;
      } else {
        field += ch === '\r' ? '\n' : ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
      quoteStartRow = row;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (inQuotes) return { records, unterminatedQuoteRow: quoteStartRow };
  if (field !== '' || cells.length > 0) endRecord(); // 마지막 줄바꿈이 없는 경우
  return { records, unterminatedQuoteRow: null };
}
