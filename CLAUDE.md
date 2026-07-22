# CLAUDE.md — 다니엘과 세친구 (앱 구현)

소그룹 QT 나눔 앱. `design/` 의 프로토타입을 Expo + Supabase 로 실제 구현한 코드입니다.
셋업·배포 순서는 `README.md`, 원래 기획 명세는 `design/HANDOFF.md` 를 보세요.

## 규칙

- **디자인은 프로토타입이 기준입니다.** 색·간격·카피를 바꾸기 전에
  `design/다니엘과세친구.dc.html` 의 해당 부분을 확인하세요.
- 색은 반드시 `src/theme.ts` 의 토큰을 쓰세요. 새 색이 필요하면 토큰에 이름을 붙여 추가합니다.
- 서체는 `Serif`(Gowun Batang — 제목·성경 본문·나눔 글)와 `Sans`(Gowun Dodum — UI) 두 컴포넌트로만 씁니다.
  `<Text>` 를 직접 쓰지 마세요.
- 모든 DB 접근은 `src/lib/api.ts` 를 거칩니다. 화면에서 `supabase` 를 직접 부르지 마세요.
- 스키마를 바꾸면 `supabase/migrations/` 에 새 파일을 추가하고 `src/types.ts` 도 같이 고칩니다.
- 사용자에게 보이는 문구는 한국어 존댓말, 잔잔한 톤. 이모지는 프로토타입에 있던 자리(🙏)만.

## 자주 만지는 곳

| 하고 싶은 일 | 파일 |
|---|---|
| 화면 흐름 바꾸기 | `app/` (expo-router) |
| 쿼리 추가 | `src/lib/api.ts` |
| 오늘의 보드 로직 | `src/lib/useBoard.ts` |
| 스트릭·참여율 계산 | `src/lib/date.ts` |
| RLS·테이블 | `supabase/migrations/0001_init.sql` |
| 아이콘 재생성 | `node scripts/make-icons.mjs` |

## 검증

```bash
npx tsc --noEmit     # 타입 체크 (= npm run lint)
npx expo start       # 실행
```

음성 녹음·푸시는 Expo Go 에서 동작하지 않습니다. `eas build --profile development` 로
개발 빌드를 만들어 확인하세요.
