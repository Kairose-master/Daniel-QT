/**
 * 로고마크(풀무불 엠블럼)에서 앱 아이콘·스플래시를 생성합니다.
 *   node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
mkdirSync(assets, { recursive: true });

const PAPER = '#f1e6d2';

/** @param {{bg?: string, scale?: number}} opts */
function emblemSvg({ bg = 'none', scale = 1 } = {}) {
  // 아트워크의 실제 bbox 는 x 20..80 / y 8..88 이라 광학 중심을 따로 맞춥니다.
  const tx = 50 - 50 * scale;
  const ty = 50 - 48 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <defs>
    <linearGradient id="flm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4c25a"/><stop offset=".55" stop-color="#e0964a"/><stop offset="1" stop-color="#a8583a"/>
    </linearGradient>
    <radialGradient id="glm" cx="50%" cy="60%" r="46%">
      <stop offset="0" stop-color="#fff7e6" stop-opacity=".92"/><stop offset="1" stop-color="#fff7e6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bg === 'none' ? '' : `<rect width="100" height="100" fill="${bg}"/>`}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="M50 8 C64 30 80 44 68 66 A22 22 0 1 1 32 66 C20 44 36 30 50 8 Z" fill="url(#flm)"/>
    <ellipse cx="50" cy="62" rx="21" ry="25" fill="url(#glm)"/>
    <path d="M29 55 A24 21 0 0 1 71 55" fill="none" stroke="#fff6e4" stroke-width="2.6" opacity=".75" stroke-linecap="round"/>
    <g fill="#fbf1dc">
      <circle cx="38" cy="60" r="3.4"/><rect x="35" y="64" width="6" height="16" rx="3"/>
      <circle cx="50" cy="57" r="3.9"/><rect x="46.3" y="61" width="7.4" height="19" rx="3.6"/>
      <circle cx="62" cy="60" r="3.4"/><rect x="59" y="64" width="6" height="16" rx="3"/>
    </g>
  </g>
</svg>`;
}

/** 단색 실루엣 (안드로이드 모노크롬 아이콘) */
function monochromeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <g transform="translate(15 15) scale(0.7)">
    <path d="M50 8 C64 30 80 44 68 66 A22 22 0 1 1 32 66 C20 44 36 30 50 8 Z" fill="#000"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon.png', svg: emblemSvg({ bg: PAPER, scale: 0.74 }), size: 1024 },
  { file: 'adaptive-icon.png', svg: emblemSvg({ bg: PAPER, scale: 0.62 }), size: 1024 },
  { file: 'android-icon-foreground.png', svg: emblemSvg({ scale: 0.58 }), size: 1024 },
  { file: 'android-icon-background.png', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${PAPER}"/></svg>`, size: 1024 },
  { file: 'android-icon-monochrome.png', svg: monochromeSvg(), size: 1024 },
  { file: 'splash-icon.png', svg: emblemSvg({ scale: 1 }), size: 512 },
  { file: 'favicon.png', svg: emblemSvg({ bg: PAPER, scale: 0.78 }), size: 96 },
];

for (const t of targets) {
  const out = join(assets, t.file);
  const png = await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toBuffer();
  writeFileSync(out, png);
  console.log(`✓ ${t.file} (${t.size}px)`);
}
