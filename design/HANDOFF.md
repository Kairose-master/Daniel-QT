# 다니엘과 세친구 — 개발 핸드오프

소그룹 QT(큐티) 나눔 앱. 이 문서는 디자인 프로토타입(`다니엘과세친구.dc.html`)을 실제 서비스로 개발하기 위한 명세입니다. 프로토타입이 화면·인터랙션의 기준입니다.

## 컨셉
관리자(리더)가 소그룹에 매일 본문(날짜·본문 범위·관련 링크·묵상 글)을 올리면, 팔로워(멤버)들이 각자 느낀점과 기도제목을 작성한다. 서로의 QT를 가로로 늘어선 카드에서 탭해 옆으로 펼쳐 보며 댓글·위로 스탬프로 반응하고, 응원 음성을 녹음해 나눈다. 출석부로 참여도를 확인한다.

## 권장 기술 스택
- **프론트엔드**: Flutter (iOS·Android·웹 동시) 또는 React Native + Expo. 웹 우선이면 React + PWA.
- **백엔드/DB**: Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions). Firebase도 가능.
- **인증**: Supabase Auth의 Kakao OAuth 프로바이더 (별도 서버 없이 카카오 로그인).
- **파일(음성)**: Supabase Storage 버킷.
- **AI 본문 생성**: Edge Function에서 Anthropic Claude API 호출.
- **푸시 알림**: FCM 또는 Expo Push.

## 화면별 기능 명세

### 온보딩 · 로그인
- 스플래시(가치 제안) → 로그인 → 초대코드 입력 → 참여 완료의 4단계.
- 로그인: 카카오로 시작하기(기본), 이메일로 시작하기(대체).
- 초대코드로 소그룹 참여. 코드가 없으면 "새 소그룹 만들기"로 리더가 됨.

### 묵상 홈 (핵심 화면)
- **오늘의 본문 카드**: 날짜·본문 범위·성경 구절·관련 링크·참여율(예: 4/6).
- **오늘의 타임라인**: 누가 몇 시에 QT를 올렸는지 시간순 피드 + 한 줄 미리보기. 탭하면 해당 멤버 카드로 이동.
- **함께 묵상한 사람들**: 멤버 카드가 가로로 늘어서고(느낀점 한 줄 미리보기), 탭하면 옆으로 펼쳐지며 느낀점·기도제목·댓글·음성·위로 스탬프 표시. 가로 스와이프 + 스크롤 스냅.
- **위로 스탬프**: 기도할게요 / 함께해요 / 힘내요 / 은혜예요 — 1인 1개 토글, 카운트 집계.
- **댓글**: 각 QT에 서로 위로 댓글.

### QT 작성
- 하단 시트로 느낀점 + 기도제목 입력 → 올리면 본인 카드가 채워지고 참여율·타임라인·스트릭 갱신.

### 출석부
- 주간 평균 참여율·최장 연속 묵상 통계.
- 멤버별 최근 7일 참여 점 그리드 + 참여 횟수 (qt_entries에서 파생 계산).

### 응원함 (음성)
- 마이크로 응원 메시지 녹음 → 특정 멤버에게 전송.
- 받은/보낸 필터, 안 들은 표시, 재생 진행바(파형).
- 녹음 파일은 Storage 업로드 후 voice_messages 행 생성.

### 관리자 대시보드 (리더 전용)
- 오늘의 본문 등록: 날짜·본문 범위·관련 링크·묵상 안내 글.
- **AI로 본문 작성**: 안내 글을 비워두면 AI가 본문 기준 묵상 글 생성.
- 오늘 참여 현황: 멤버별 완료/대기 상태.

## 데이터 구조 (Supabase / PostgreSQL)

| 테이블 | 주요 컬럼 | 설명 |
|---|---|---|
| users | id, kakao_id, name, avatar_url, created_at | Supabase Auth 사용자와 1:1 |
| groups | id, name, invite_code(unique), leader_id, created_at | 소그룹 |
| group_members | group_id, user_id, role(leader/member), joined_at | 멤버십 (N:N) |
| passages | id, group_id, date, ref, verse_text, link_url, devotion, ai_generated | 일자별 본문(관리자 등록) |
| qt_entries | id, passage_id, user_id, reflection, prayer, created_at | 멤버별 QT 나눔. 출석·스트릭 원천 |
| comments | id, qt_entry_id, user_id, text, created_at | 위로 댓글 |
| stamps | qt_entry_id, user_id, kind(pray/together/cheer/grace) | 위로 스탬프. (qt_entry_id,user_id) 유니크 |
| voice_messages | id, group_id, from_user_id, to_user_id, storage_path, duration, heard, created_at | 응원 음성 |

- 출석·참여율·연속 묵상(스트릭)은 별도 테이블 없이 `qt_entries`의 date/user 집계로 계산(뷰 또는 쿼리).
- RLS(행 수준 보안)로 자신이 속한 group의 데이터만 접근하도록 정책 설정.

## 카카오 로그인 연동
1. developers.kakao.com에서 애플리케이션 생성 → JavaScript 키 / REST API 키 발급.
2. 카카오 로그인 활성화, Redirect URI 등록(Supabase Auth 콜백: `https://<project>.supabase.co/auth/v1/callback`).
3. Supabase → Authentication → Providers → Kakao 켜고 REST 키/시크릿 입력.
4. 동의 항목: profile_nickname, profile_image.
5. 앱에서 `supabase.auth.signInWithOAuth({ provider: 'kakao' })`.

> 프로토타입 코드의 `KAKAO_JS_KEY` 자리는 순수 카카오 JS SDK 직접 연동용 참고 지점. Supabase Auth를 쓰면 위 방식이 더 간단함.

## AI 본문 · 음성 처리
- **AI 본문**: 관리자가 devotion을 비운 채 저장하면 Edge Function이 ref로 Claude에 묵상 안내 글을 요청 → passages.devotion 채우고 ai_generated=true.
- **음성 녹음**: 마이크 권한 → 로컬 녹음(m4a/webm) → Storage 업로드 → voice_messages 행 생성. 재생 시 heard=true.
- **알림**: 관리자 본문 등록 시 소그룹 멤버에게 푸시.

## 음성 응원 메시지 (상세)
멤버가 서로에게 격려의 목소리를 직접 녹음해 보내고, 받는 사람이 '응원함'에서 재생하는 기능. 오디오 파일 처리가 핵심.

### 녹음 → 전송 흐름
1. 마이크 권한 요청 (iOS `NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`).
2. 녹음 시작/정지 (최대 길이 권장 60초). 녹음 중 경과 시간·파형 표시.
3. 받을 멤버 선택(같은 소그룹 내) → 로컬 파일 생성.
4. Supabase Storage 버킷 `voice/{group_id}/{uuid}.m4a` 업로드.
5. `voice_messages` 행 생성 (from/to/storage_path/duration, heard=false).
6. 받는 사람에게 푸시 알림 "○○님이 응원 음성을 보냈어요".

### 재생 (응원함)
- Storage 서명 URL(만료 시간 지정)로 스트리밍 재생.
- 재생 진행바 — 파형은 녹음 시 진폭 샘플을 저장하거나 데코용 막대로 표현.
- 재생 완료 시 `heard=true` 업데이트.
- 받은/보낸 필터, 안 들은 배지, 본인이 보낸 메시지 삭제.

### 포맷 · 라이브러리
| 플랫폼 | 녹음/재생 | 포맷 |
|---|---|---|
| Flutter | `record` + `just_audio` | AAC(m4a) |
| React Native | `expo-av` (Audio.Recording / Sound) | AAC(m4a) |
| 웹(PWA) | MediaRecorder API / `<audio>` | webm/opus |

### 저장 · 보안
- Storage 버킷은 비공개. 정책으로 같은 `group_id` 멤버만 read/insert.
- 다운로드는 항상 만료되는 서명 URL로만. 원본 경로 직접 노출 금지.
- 용량 관리: 최대 길이 제한 + 오래된 메시지 자동 정리(선택).

## 개발 순서 제안
1. Supabase 프로젝트 + 스키마 + RLS 정책.
2. 카카오 로그인 → 소그룹 생성/초대코드 참여.
3. 관리자 본문 등록 → 멤버 QT 작성 → 묵상 홈(타임라인·펼침 카드).
4. 댓글·위로 스탬프 → 출석 집계.
5. 응원함 음성 녹음/재생 → 푸시 알림 → AI 본문.
6. 스토어 배포(Apple Developer / Google Play Console).

## 브랜드
- 로고: 풀무불(불꽃) 안에 세 친구가 나란히 서 있고, 위로 지켜주시는 임재의 아치가 감싸는 엠블럼. `로고.dc.html`(전체 시스템), `로고마크.dc.html`(재사용 SVG 엠블럼).
- 색: 클레이 `#a86b4d`, 골드 `#e0964a`/`#f4c25a`, 세이지 `#7c8a6d`, 종이빛 배경 `#f6f1e8`.
- 서체: Gowun Batang(본문·제목, 세리프), Gowun Dodum(UI).

## 파일 목록
- `다니엘과세친구.dc.html` — 앱 프로토타입 (전 화면 + 인터랙션)
- `로고.dc.html` — 로고 시스템 (아이콘/워드마크/단색)
- `로고마크.dc.html` — 엠블럼 컴포넌트(SVG)
- `핸드오프문서.dc.html` — 본 문서 인쇄용
- `HANDOFF.md` — 본 문서
- `CLAUDE.md` — Claude Code 작업 지침

> `.dc.html` 파일은 Design Component 형식이며 브라우저에서 바로 열립니다. 로직은 파일 하단 `<script>`의 `class Component`에, 화면은 `<x-dc>` 안 인라인 스타일 마크업에 있습니다.
