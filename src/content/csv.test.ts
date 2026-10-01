import { afterEach, describe, expect, it, vi } from 'vitest';
import templateCsv from '../../data/content-template.csv?raw';
import { parseContentCsv, parseCsv } from './csv';

const HEADER = '세트ID,말씀 출처,말씀 원문,문제 번호,문제,보기1,보기2,보기3,보기4,보기5,정답 번호';

/** 세트 하나(5행). 문제 n의 정답은 보기 n번 */
function setRows(setId: string, opts: { order?: number[] } = {}): string[] {
  const order = opts.order ?? [1, 2, 3, 4, 5];
  return order.map((n, i) =>
    [setId, i === 0 ? '출처 1:1' : '', i === 0 ? '원문' : '', n, `문제${n} ___ 입니다`,
      '가', '나', '다', '라', '마', n].join(','));
}
const csv = (...lines: string[]) => lines.join('\n');

afterEach(() => vi.useRealTimers());

describe('parseCsv (RFC 4180)', () => {
  it('따옴표 안의 쉼표·줄바꿈, "" 이스케이프, CRLF', () => {
    const { records } = parseCsv('a,"b,c","줄1\r\n줄2",\"말\"\"씀\"\r\nx,,y,\r\n');
    expect(records).toEqual([
      { row: 1, cells: ['a', 'b,c', '줄1\n줄2', '말"씀'] },
      { row: 2, cells: ['x', '', 'y', ''] },
    ]);
  });

  it('마지막 줄바꿈이 없어도 마지막 행을 읽는다, CR만 있는 줄바꿈', () => {
    expect(parseCsv('a,b\rc,d').records.map((r) => r.cells)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('닫히지 않은 따옴표는 시작 행을 알린다', () => {
    expect(parseCsv('a\n"b,c\nd').unterminatedQuoteRow).toBe(2);
  });
});

describe('parseContentCsv', () => {
  it('정상 변환: id 자동 생성, 정답 번호 → id, 말씀 정보는 첫 행에서', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const r = parseContentCsv(csv(HEADER, ...setRows('set-1'), ...setRows('set-2')));
    expect(r.issues).toEqual([]);
    expect(r.content!.contentVersion).toBe('csv-2026-10-01T12:00:00.000Z');
    expect(r.content!.questionSets.map((s) => s.id)).toEqual(['set-1', 'set-2']);
    const set = r.content!.questionSets[0];
    expect(set).toMatchObject({ scriptureReference: '출처 1:1', scriptureText: '원문' });
    expect(set.questions[1]).toEqual({
      id: 'set-1-q2',
      prompt: '문제2 ___ 입니다',
      choices: ['가', '나', '다', '라', '마'].map((text, k) => ({ id: `set-1-q2-c${k + 1}`, text })),
      correctChoiceId: 'set-1-q2-c2',
    });
  });

  it('문제 번호로 정렬한다', () => {
    const r = parseContentCsv(csv(HEADER, ...setRows('s', { order: [3, 1, 5, 2, 4] })));
    expect(r.content!.questionSets[0].questions.map((q) => q.id)).toEqual(['s-q1', 's-q2', 's-q3', 's-q4', 's-q5']);
    expect(r.content!.questionSets[0].scriptureReference).toBe('출처 1:1');
  });

  it('BOM, CRLF, 빈 행, 열 순서·헤더 공백 차이, "3번" 표기, 따옴표 속 쉼표를 처리한다', () => {
    const header = '정답 번호,세트ID,말씀출처,말씀 원문,문제 번호,문제,보기1,보기2,보기3,보기4,보기5';
    const lines = [1, 2, 3, 4, 5].map((n) =>
      `${n}번,s,"출처, 1장","원문, 쉼표",${n},"문제 ""${n}"" ___",가,나,다,라,마`);
    const r = parseContentCsv('﻿' + [header, lines[0], '', ',,,,,,,,,,', ...lines.slice(1)].join('\r\n') + '\r\n');
    expect(r.issues).toEqual([]);
    const set = r.content!.questionSets[0];
    expect(set.scriptureReference).toBe('출처, 1장');
    expect(set.questions[0].prompt).toBe('문제 "1" ___');
    expect(set.questions[3].correctChoiceId).toBe('s-q4-c4');
  });

  it('템플릿 파일(data/content-template.csv)이 오류 없이 변환된다', () => {
    const r = parseContentCsv(templateCsv);
    expect(r.issues).toEqual([]);
    expect(r.content!.questionSets).toHaveLength(2);
    expect(r.content!.questionSets[0].scriptureReference).toBe('요한복음 3:16');
    for (const set of r.content!.questionSets) {
      for (const q of set.questions) {
        // 빈칸에 정답을 넣으면 말씀 원문이 된다
        const answer = q.choices.find((c) => c.id === q.correctChoiceId)!.text;
        expect(q.prompt.replace('___', answer)).toBe(set.scriptureText);
      }
    }
  });

  describe('오류는 CSV 행 번호로 알린다', () => {
    it('헤더 칸 누락', () => {
      const r = parseContentCsv('세트ID,문제\ns,x');
      expect(r.content).toBeNull();
      expect(r.issues).toEqual([{ location: '1행(헤더)', message: expect.stringContaining('정답 번호') }]);
    });

    it('글자가 깨진 헤더 → 인코딩 안내', () => {
      const r = parseContentCsv('��ID,��\n');
      expect(r.issues[0].message).toContain('UTF-8');
    });

    it('빈 파일, 헤더만 있는 파일', () => {
      expect(parseContentCsv('').issues[0].location).toBe('전체');
      expect(parseContentCsv(HEADER + '\n').issues[0].message).toContain('문제 행이 없습니다');
    });

    it('닫히지 않은 따옴표', () => {
      const r = parseContentCsv(csv(HEADER, ...setRows('s').slice(0, 2), 's,,,3,"열린 따옴표 ___,가'));
      expect(r.issues).toEqual([{ location: '4행', message: expect.stringContaining('큰따옴표') }]);
    });

    it('정답 번호·문제 번호 오류, 중복 문제 번호, 세트ID 누락', () => {
      const rows = setRows('s');
      rows[1] = rows[1].replace(/,2$/, ',6'); // 3행: 정답 6
      rows[2] = rows[2].replace(',3,문제3', ',2,문제3'); // 4행: 문제 번호 2 중복
      rows[3] = rows[3].replace(/^s,/, ','); // 5행: 세트ID 없음
      rows[4] = rows[4].replace(',5,문제5', ',다섯,문제5'); // 6행
      const r = parseContentCsv(csv(HEADER, ...rows));
      expect(r.content).toBeNull();
      expect(r.issues).toEqual([
        { location: '3행(세트 s)', message: expect.stringContaining('정답 번호') },
        { location: '4행(세트 s)', message: expect.stringContaining('3행과 중복') },
        { location: '5행', message: expect.stringContaining('세트ID') },
        { location: '6행(세트 s)', message: expect.stringContaining('"다섯"') },
      ]);
    });

    it('검증 오류(빈 보기, 빈칸 없음, 문제 수)를 행 번호로 바꾼다', () => {
      const a = setRows('a');
      a[1] = a[1].replace(',가,나,다,라,', ',가,나,다,,'); // 3행 보기4 비움
      a[2] = a[2].replace('문제3 ___ 입니다', '빈칸 없음'); // 4행
      const b = setRows('b').slice(0, 4); // 7~10행, 4문제
      const r = parseContentCsv(csv(HEADER, ...a, ...b));
      expect(r.content).toBeNull();
      expect(r.issues.map((i) => i.location)).toEqual([
        '3행(세트 a 문제 2) 보기4 칸',
        '4행(세트 a 문제 3)',
        '7~10행(세트 b)',
      ]);
      expect(r.issues[2].message).toContain('4개');
    });

    it('줄바꿈이 든 셀이 있어도 행 번호는 스프레드시트 행 기준', () => {
      const rows = setRows('s');
      rows[0] = rows[0].replace('원문', '"원문\n둘째 줄"');
      rows[2] = rows[2].replace('문제3 ___ 입니다', '');
      const r = parseContentCsv(csv(HEADER, ...rows));
      expect(r.issues.map((i) => i.location)).toEqual(['4행(세트 s 문제 3)']);
      expect(parseContentCsv(csv(HEADER, ...setRows('s'))).content!.questionSets[0].scriptureText).toBe('원문');
    });

    it('세트 안에서 말씀 출처가 서로 다르면 오류', () => {
      const rows = setRows('s');
      rows[2] = rows[2].replace(/^s,,/, 's,다른 출처,');
      expect(parseContentCsv(csv(HEADER, ...rows)).issues).toEqual([
        { location: '4행(세트 s)', message: expect.stringContaining('말씀 출처') },
      ]);
    });

    it('헤더보다 칸이 많으면 (따옴표 없는 쉼표) 안내', () => {
      const rows = setRows('s');
      rows[0] = rows[0].replace('가,나', '가,나,덤');
      const r = parseContentCsv(csv(HEADER, ...rows));
      expect(r.issues[0]).toEqual({ location: '2행', message: expect.stringContaining('큰따옴표') });
    });
  });
});
