import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

/** 묵상 열매 마크 — 잔잔한 골드 열매에 작은 세이지 잎. */
export function FruitMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 잎 */}
      <Path
        d="M12 8 C12 4 15 3 17 3 C17 6 15.5 8 12.5 8.2 Z"
        fill={colors.sage}
        opacity={0.9}
      />
      {/* 열매 */}
      <Circle cx="11" cy="15" r="6.2" fill={colors.gold} />
      <Circle cx="9" cy="13" r="1.6" fill="#fff" opacity={0.45} />
    </Svg>
  );
}
