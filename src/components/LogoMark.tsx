import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** 로고마크.dc.html 의 엠블럼 — 풀무불 안에 나란히 선 세 친구. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="flm" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f4c25a" />
          <Stop offset="0.55" stopColor="#e0964a" />
          <Stop offset="1" stopColor="#a8583a" />
        </LinearGradient>
        <RadialGradient id="glm" cx="50%" cy="60%" r="46%">
          <Stop offset="0" stopColor="#fff7e6" stopOpacity="0.92" />
          <Stop offset="1" stopColor="#fff7e6" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path
        d="M50 8 C64 30 80 44 68 66 A22 22 0 1 1 32 66 C20 44 36 30 50 8 Z"
        fill="url(#flm)"
      />
      <Ellipse cx="50" cy="62" rx="21" ry="25" fill="url(#glm)" />
      <Path
        d="M29 55 A24 21 0 0 1 71 55"
        fill="none"
        stroke="#fff6e4"
        strokeWidth="2.6"
        opacity="0.75"
        strokeLinecap="round"
      />
      <G fill="#fbf1dc">
        <Circle cx="38" cy="60" r="3.4" />
        <Rect x="35" y="64" width="6" height="16" rx="3" />
        <Circle cx="50" cy="57" r="3.9" />
        <Rect x="46.3" y="61" width="7.4" height="19" rx="3.6" />
        <Circle cx="62" cy="60" r="3.4" />
        <Rect x="59" y="64" width="6" height="16" rx="3" />
      </G>
    </Svg>
  );
}
