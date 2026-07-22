const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** Date → 'YYYY-MM-DD' (기기 로컬 기준) */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** '2026.07.22 (화)' */
export function formatKoreanDate(key: string): string {
  const d = fromKey(key);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAY[d.getDay()]})`;
}

/** '오전 5:40' */
export function formatKoreanTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** '2시간 전' / '어제' / '3일 전' */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  return `${Math.floor(day / 7)}주 전`;
}

/** 0:24 형태 (초 → m:ss) */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 이번 주(월~일) 날짜 키 7개 */
export function currentWeekKeys(today: Date = new Date()): string[] {
  const offset = (today.getDay() + 6) % 7; // 월요일 시작
  const monday = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i)));
}

/** '7.20 – 7.26' */
export function weekRangeLabel(keys: string[]): string {
  if (keys.length === 0) return '';
  const a = fromKey(keys[0]);
  const b = fromKey(keys[keys.length - 1]);
  return `${a.getMonth() + 1}.${a.getDate()} – ${b.getMonth() + 1}.${b.getDate()}`;
}

export const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * 연속 묵상(스트릭). 오늘(또는 어제)부터 거꾸로 이어진 날 수.
 * 오늘 아직 안 썼어도 어제까지 이어졌으면 그 길이를 유지합니다.
 */
export function streakFrom(dates: Iterable<string>, today: Date = new Date()): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  let cursor = today;
  if (!set.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!set.has(dateKey(cursor))) return 0;
  }
  let n = 0;
  while (set.has(dateKey(cursor))) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}
