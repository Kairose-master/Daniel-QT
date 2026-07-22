# 다니엘과 세친구 — 소그룹 QT 나눔 앱

디자인 프로토타입(`design/다니엘과세친구.dc.html`)의 화면·색·카피를 그대로 유지하면서,
mock 이던 기능을 Supabase 백엔드로 실제 구현한 iOS/Android 앱입니다.

- **프론트엔드**: Expo (React Native) + TypeScript + expo-router
- **백엔드**: Supabase — PostgreSQL / Auth / Storage / Realtime / Edge Functions
- **AI 묵상 글**: Edge Function → Anthropic Claude API
- **푸시**: Expo Push (Edge Function `notify`)

---

## 1. 무엇이 실제로 동작하는가

| 기능 | 프로토타입 | 지금 |
|---|---|---|
| 로그인 | `setTimeout` 후 성공 처리 | Supabase Auth 이메일 로그인/가입, 카카오 OAuth 준비 완료 |
| 소그룹 참여 | 아무 코드나 통과 | `join_group_by_code` RPC — 실제 코드 검증, 없으면 새 소그룹 생성(리더가 됨) |
| 오늘의 본문 | 하드코딩 문자열 | `passages` 테이블, 리더만 등록/수정 (RLS) |
| AI 본문 작성 | 고정 문구 삽입 | Claude API 호출로 매번 새로 생성 |
| QT 작성 | 로컬 state 갱신 | `qt_entries` upsert, 다시 열면 수정 가능 |
| 타임라인·참여율 | 목 데이터 | 실제 나눔 시간·인원에서 계산 |
| 위로 스탬프 | 로컬 카운터 | `stamps` 테이블, (글,사람) 유니크로 1인 1개 강제 |
| 댓글 | 로컬 배열 push | `comments` 테이블 |
| 출석부 | 가짜 패턴 배열 | `qt_days` 뷰 집계 + 실제 연속 묵상(스트릭) 계산 |
| 응원 음성 | 재생 아이콘만 토글 | 마이크 녹음 → Storage 업로드 → 서명 URL 재생 → 들으면 `heard` |
| 실시간 갱신 | 없음 | Supabase Realtime 구독 |
| 푸시 알림 | 없음 | 본문 등록 / 음성 수신 시 발송 |

---

## 2. 처음 실행하기

### 2-1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성 (리전은 **Northeast Asia (Seoul)** 권장).
2. **SQL Editor** 에 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행.
   테이블 8개 + RLS 정책 + `voice` Storage 버킷 + Realtime 설정이 한 번에 만들어집니다.
3. **Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사.

### 2-2. 환경변수

```bash
cp .env.example .env
```

`.env` 를 열어 채웁니다.

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_ENABLE_KAKAO=false
```

> 값을 채우기 전에는 앱이 크래시하지 않고 "연결 설정이 필요해요" 안내 화면을 보여줍니다.

### 2-3. 실행

```bash
npm install
npx expo start
```

Expo Go 로 열면 화면·로그인·QT·출석까지 확인할 수 있습니다.
**음성 녹음과 푸시 알림은 개발 빌드(development build)가 필요합니다** — 아래 4번 참고.

> ⚠️ Node.js 20.19.4 이상이 필요합니다. 현재 20.18.0 이면 `expo start` 가 경고를 냅니다.
> https://nodejs.org 에서 최신 LTS 로 올려주세요.

---

## 3. 선택 기능 켜기

### 3-1. AI 묵상 글 (`✦ AI로 본문 작성`)

```bash
npx supabase login
npx supabase link --project-ref <프로젝트 ref>
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy generate-devotion
```

배포 전에는 버튼을 누르면 "Edge Function 배포를 확인해주세요" 안내가 뜹니다.

### 3-2. 푸시 알림

```bash
npx supabase functions deploy notify
```

앱 쪽은 EAS 프로젝트에 연결되어 있어야 토큰이 발급됩니다 (`eas init` 후 `app.json` 의
`extra.eas.projectId` 가 채워집니다).

### 3-3. 카카오 로그인

1. https://developers.kakao.com 에서 앱 생성 → **REST API 키** 와 **Client Secret** 발급.
2. 카카오 로그인 활성화 → Redirect URI 에
   `https://<프로젝트>.supabase.co/auth/v1/callback` 등록.
3. 동의 항목: `profile_nickname`, `profile_image`.
4. Supabase → **Authentication → Providers → Kakao** 를 켜고 키/시크릿 입력.
5. Supabase → **Authentication → URL Configuration → Redirect URLs** 에
   `danielqt://auth` 추가.
6. `.env` 의 `EXPO_PUBLIC_ENABLE_KAKAO=true` 로 변경.

---

## 4. iOS / Android 앱으로 빌드하기

### 4-1. 준비

```bash
npm install -g eas-cli
eas login
eas init          # app.json 의 extra.eas.projectId 를 채웁니다
```

`.env` 값은 빌드에 포함되지 않으므로 EAS 에 따로 등록합니다.

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --visibility plaintext --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --visibility plaintext --environment production
```

(`--environment preview`, `--environment development` 도 같은 방식으로 등록)

### 4-2. 개발 빌드 — 음성·푸시 테스트용

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

### 4-3. 나눠주기용 빌드 (스토어 없이 설치)

```bash
eas build --profile preview --platform android   # .apk — 링크로 바로 설치
eas build --profile preview --platform ios       # ad-hoc, 기기 UDID 등록 필요
```

Android APK 는 빌드 완료 후 나오는 링크에서 바로 내려받아 설치할 수 있습니다.
소그룹 안에서만 쓸 거라면 여기까지로 충분합니다.

### 4-4. 스토어 배포

```bash
eas build --profile production --platform all
eas submit --platform android    # Google Play (계정 $25, 1회)
eas submit --platform ios        # App Store (Apple Developer $99/년)
```

`eas.json` 에는 `submit` 설정이 없습니다. EAS 가 빈 값을 허용하지 않아서
자리표시자를 두면 `eas init` 부터 실패하기 때문입니다. 실제로 제출할 때
아래를 `eas.json` 최상위에 추가하고 값을 채우세요.

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-play-key.json",
      "track": "internal"
    },
    "ios": {
      "appleId": "본인@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDE12345"
    }
  }
}
```

안드로이드만 제출한다면 `ios` 블록은 아예 넣지 마세요.

**스토어 심사 전에 준비할 것**
- 개인정보처리방침 URL (음성 녹음·이메일 수집 항목 명시) — 두 스토어 모두 필수
- 앱 스크린샷 (iOS 6.7"/6.1", Android 폰)
- 마이크 권한 사용 이유 — `app.json` 에 한국어로 이미 적어두었습니다
- 계정 삭제 수단 (Apple 필수) — 현재 미구현, 심사 전 추가 필요

---

## 5. 구조

```
app/                      화면 (expo-router)
  _layout.tsx             폰트·세션·알림 부트스트랩
  index.tsx               로그인/소그룹 여부에 따른 분기
  onboarding.tsx          스플래시 → 로그인 → 소그룹 → 완료
  settings.tsx            이름·초대코드·소그룹 전환·로그아웃
  (tabs)/
    index.tsx             묵상 홈 (본문·타임라인·펼침 카드·QT 작성)
    attend.tsx            출석부
    cheer.tsx             응원함 (녹음·전송·재생)
    admin.tsx             관리자 (본문 등록·AI·참여 현황)
src/
  theme.ts                디자인 토큰 (프로토타입에서 추출)
  types.ts                DB 타입
  lib/
    supabase.ts           클라이언트
    session.tsx           인증 + 소그룹 컨텍스트
    api.ts                모든 쿼리
    useBoard.ts           오늘의 보드 + Realtime
    date.ts               날짜·스트릭 계산
    notifications.ts      푸시 토큰 등록/발송
  components/
    ui.tsx                Serif/Sans/Avatar/Button/Field …
    MemberCard.tsx        가로 펼침 카드
    LogoMark.tsx          엠블럼 (SVG)
supabase/
  migrations/0001_init.sql
  functions/generate-devotion/   AI 묵상 글
  functions/notify/              푸시 발송
scripts/make-icons.mjs    로고마크 → 앱 아이콘 생성
design/                   원본 프로토타입 (참조용)
```

## 6. 남은 일

- [ ] 계정 삭제 화면 (App Store 심사 필수)
- [ ] 개인정보처리방침 / 이용약관 페이지 연결
- [ ] 녹음 파형을 실제 진폭 샘플로 (현재는 데코용 막대 + 재생 진행 표시)
- [ ] 오래된 음성 자동 정리 (Storage 용량 관리)
- [ ] 지난 날짜 본문 다시 보기 (아카이브)
