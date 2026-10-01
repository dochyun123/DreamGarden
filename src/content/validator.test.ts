import { describe, expect, it } from 'vitest';
import sample from '../../data/sample-content.json';
import type { ContentFile } from '../types';
import { parseContentFile, validateTeamDrafts } from './validator';

const content = sample as ContentFile;
const copy = (): any => JSON.parse(JSON.stringify(sample));

describe('parseContentFile', () => {
  it('샘플 데이터는 오류 없이 통과한다', () => {
    const r = parseContentFile(copy());
    expect(r.issues).toEqual([]);
    expect(r.content).toEqual(content);
  });

  it('객체가 아니거나 세트가 없으면 전체 오류', () => {
    expect(parseContentFile(null)).toEqual({ content: null, issues: [expect.objectContaining({ location: '전체' })] });
    expect(parseContentFile([]).content).toBeNull();
    const r = parseContentFile({ contentVersion: 'v', questionSets: [] });
    expect(r.content).toBeNull();
    expect(r.issues[0].location).toBe('전체');
  });

  it('문제 수와 보기 수가 5개가 아니면 위치와 함께 알린다', () => {
    const d = copy();
    d.questionSets[0].questions.pop();
    d.questionSets[1].questions[2].choices.pop();
    const r = parseContentFile(d);
    expect(r.content).toBeNull();
    expect(r.issues).toEqual([
      { location: '세트 set-1', message: expect.stringContaining('4개') },
      { location: '세트 set-2 > 문제 3', message: expect.stringContaining('4개') },
    ]);
  });

  it('빈 문구는 오류 (공백만 있어도)', () => {
    const d = copy();
    d.questionSets[0].scriptureText = '  ';
    d.questionSets[0].questions[1].choices[3].text = '';
    const r = parseContentFile(d);
    expect(r.issues.map((i) => i.location)).toEqual(['세트 set-1', '세트 set-1 > 문제 2 > 보기 4']);
  });

  it('id 중복: 세트 간, 세트 내 문제, 문제 내 보기', () => {
    const d = copy();
    d.questionSets[1].id = 'set-1';
    d.questionSets[2].questions[1].id = d.questionSets[2].questions[0].id;
    d.questionSets[3].questions[0].choices[4].id = d.questionSets[3].questions[0].choices[0].id;
    const r = parseContentFile(d);
    expect(r.content).toBeNull();
    expect(r.issues.map((i) => i.location)).toEqual([
      '세트 set-1',
      '세트 set-3 > 문제 2',
      '세트 set-4 > 문제 1 > 보기 5',
    ]);
    r.issues.forEach((i) => expect(i.message).toContain('중복'));
  });

  it('정답 id가 보기에 없으면 오류', () => {
    const d = copy();
    d.questionSets[0].questions[4].correctChoiceId = 'nope';
    const r = parseContentFile(d);
    expect(r.issues).toEqual([{ location: '세트 set-1 > 문제 5', message: expect.stringContaining('nope') }]);
  });

  it('빈칸 "___" 표시가 없으면 오류', () => {
    const d = copy();
    d.questionSets[0].questions[0].prompt = '빈칸 없는 문장 __';
    const r = parseContentFile(d);
    expect(r.issues).toEqual([{ location: '세트 set-1 > 문제 1', message: expect.stringContaining('빈칸') }]);
  });

  it('필드 타입이 틀리거나 누락되면 오류, 알 수 없는 필드는 버린다', () => {
    const d = copy();
    delete d.contentVersion;
    d.questionSets[0].questions[0].choices[0] = 'x';
    d.questionSets[1].extra = 1;
    expect(parseContentFile(d).issues.map((i) => i.location)).toEqual(['전체', '세트 set-1 > 문제 1 > 보기 1']);

    const ok = copy();
    ok.questionSets[1].extra = 1;
    expect(parseContentFile(ok).content!.questionSets[1]).not.toHaveProperty('extra');
  });
});

describe('validateTeamDrafts', () => {
  it('정상 등록은 오류 없음', () => {
    expect(validateTeamDrafts([
      { name: '믿음팀', questionSetId: 'set-1' },
      { name: '소망팀', questionSetId: 'set-2' },
    ], content)).toEqual([]);
  });

  it('공백 이름, 앞뒤 공백을 무시한 중복 이름', () => {
    const issues = validateTeamDrafts([
      { name: '믿음팀', questionSetId: 'set-1' },
      { name: '   ', questionSetId: 'set-2' },
      { name: ' 믿음팀 ', questionSetId: 'set-3' },
    ], content);
    expect(issues).toEqual([
      { location: '팀 2번', message: expect.stringContaining('비어') },
      { location: '팀 3번(믿음팀)', message: expect.stringContaining('1번') },
    ]);
  });

  it('세트 연결 누락·존재하지 않는 세트', () => {
    const issues = validateTeamDrafts([
      { name: 'A', questionSetId: '' },
      { name: 'B', questionSetId: 'set-99' },
    ], content);
    expect(issues).toEqual([
      { location: '팀 1번(A)', message: expect.stringContaining('연결') },
      { location: '팀 2번(B)', message: expect.stringContaining('set-99') },
    ]);
  });

  it('팀이 없으면 오류', () => {
    expect(validateTeamDrafts([], content)).toHaveLength(1);
  });
});
