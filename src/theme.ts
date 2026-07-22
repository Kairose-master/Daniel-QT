/**
 * 디자인 토큰 — 프로토타입(다니엘과세친구.dc.html)의 인라인 스타일에서 추출.
 * 새 색을 쓰기 전에 여기에 이름을 붙이세요.
 */
export const colors = {
  clay: '#a86b4d',
  clayDark: '#8f5638',
  clayDeep: '#8a4a30',
  gold: '#e0964a',
  goldLight: '#f4c25a',
  sage: '#7c8a6d',
  sageLight: '#96b07a',

  paper: '#f6f1e8',
  paperWarm: '#f9f5ee',
  card: '#fffdf8',
  cardMuted: '#f4efe6',
  field: '#faf6ee',
  tint: '#f4efe4',
  tintDeep: '#efe7d8',
  chip: '#f3ece0',

  ink: '#33302a',
  ink900: '#2f2b23',
  ink800: '#332f28',
  ink700: '#453f34',
  ink600: '#4d473c',
  ink500: '#6a6153',
  ink400: '#7a7263',

  muted: '#9a8f7a',
  muted2: '#a2957c',
  muted3: '#b1a488',
  muted4: '#c0b49a',
  muted5: '#c9bda4',
  label: '#c0a878',
  labelSoft: '#b6a88f',

  line: '#eae1d1',
  lineWarm: '#eadfca',
  lineSoft: '#efe7d8',
  lineField: '#e6dbc7',
  lineDash: '#d3b98f',
  lineStrong: '#ddccb0',

  empty: '#ece3d2',
  bar: '#d8ccb6',
  kakao: '#FEE500',
  kakaoInk: '#191600',
  warn: '#c9a24d',
  danger: '#b4553f',
  white: '#ffffff',
} as const;

/** 멤버 아바타 색 — user id 해시로 안정적으로 배정 */
export const avatarPalette = [
  '#a86b4d',
  '#7c8a6d',
  '#8a7f9a',
  '#a98a63',
  '#9a8f7a',
  '#7d8a94',
  '#947d7d',
  '#6d8a8a',
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}

/** 한글 이름의 첫 글자 (아바타 이니셜) */
export function initialOf(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n ? Array.from(n)[0] : '·';
}

export const fonts = {
  serif: 'GowunBatang_400Regular',
  serifBold: 'GowunBatang_700Bold',
  sans: 'GowunDodum_400Regular',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 20,
  xxl: 26,
  pill: 999,
} as const;

export const stampTypes = [
  { key: 'pray', label: '기도할게요' },
  { key: 'together', label: '함께해요' },
  { key: 'cheer', label: '힘내요' },
  { key: 'grace', label: '은혜예요' },
] as const;

export type StampKind = (typeof stampTypes)[number]['key'];
