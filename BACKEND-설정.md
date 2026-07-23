# 백엔드 추가 설정 (AI 본문 · 푸시 · 카카오)

앱 코드는 이미 이 기능들을 호출하도록 되어 있습니다. 아래는 **서버 쪽에서 한 번만**
켜주면 되는 작업입니다. 순서 상관없이 필요한 것만 하세요.

---

## 0. 파형 컬럼 마이그레이션 (음성 파형용)

Supabase 대시보드 > SQL Editor 에 `supabase/migrations/0002_waveform.sql` 을 붙여넣고 Run.
(이걸 안 하면 새 음성 전송 시 "column waveform ... does not exist" 오류가 납니다.)

---

## 1. Supabase CLI 로그인 · 연결 (최초 1회)

Edge Function 배포에 필요합니다.

```
npx supabase login
npx supabase link --project-ref stogdbsokgdjfnmxcuds
```

`login` 은 브라우저가 열리며 access token 을 발급받습니다.

---

## 2. AI 본문 생성 켜기

관리 탭의 "✦ AI로 본문 작성" 버튼이 실제로 동작하게 합니다.

```
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # console.anthropic.com 에서 발급
npx supabase functions deploy generate-devotion
```

- 함수는 `claude-sonnet-5` 모델로 200자 내외 묵상 안내 글을 생성합니다.
- 배포 전에는 버튼을 누르면 "Edge Function 배포를 확인해주세요" 안내가 뜹니다.

## 3. 푸시 알림 켜기

본문 등록 / 음성 수신 시 소그룹에 알림이 갑니다.

```
npx supabase functions deploy notify
```

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` 는 Supabase 가
  자동 주입하므로 따로 설정할 필요 없습니다.
- **주의**: 푸시 토큰은 EAS 프로젝트에 연결된 빌드에서만 발급됩니다. 개발 빌드/실기기에서
  앱을 한 번 실행해 알림 권한을 허용하면 `push_tokens` 테이블에 토큰이 쌓입니다.
- Expo Go 에서는 푸시가 동작하지 않습니다 (개발 빌드 필요).

## 3-1. 계정 삭제 (앱스토어 심사 필수)

내 설정 > "계정 삭제" 가 실제로 동작하게 합니다. (Apple 은 계정 생성 앱에
계정 삭제 수단을 의무화합니다.)

```
npx supabase functions deploy delete-account
```

- 본인 토큰으로만 자기 계정을 지웁니다. 리더면 남은 멤버에게 리더를 이양하고,
  혼자면 소그룹째 삭제합니다. 올린 음성 파일도 Storage 에서 정리합니다.

배포 후 함수들이 잘 올라갔는지 확인:

```
npx supabase functions list
```

---

## 4. 카카오 로그인 켜기

1. https://developers.kakao.com 에서 애플리케이션 생성.
2. **앱 키 > REST API 키** 와 **보안 > Client Secret** (사용함으로 설정) 발급.
3. **카카오 로그인 활성화 ON**, Redirect URI 에 아래 등록:
   ```
   https://stogdbsokgdjfnmxcuds.supabase.co/auth/v1/callback
   ```
4. **동의항목**: 닉네임(profile_nickname), 프로필 사진(profile_image) 필수 동의.
5. Supabase 대시보드 > Authentication > Providers > **Kakao** 켜고
   REST API 키(=Client ID) 와 Client Secret 입력.
6. Supabase > Authentication > URL Configuration > **Redirect URLs** 에 추가:
   ```
   danielqt://auth
   ```
7. 앱의 `.env` 에서 `EXPO_PUBLIC_ENABLE_KAKAO=true` 로 바꾸고,
   EAS 환경변수에도 등록 후 재빌드:
   ```
   npx eas-cli env:create --name EXPO_PUBLIC_ENABLE_KAKAO --value true --environment preview --environment production --environment development --visibility plaintext --scope project --non-interactive
   ```

이렇게 하면 온보딩 로그인 화면에 "카카오로 시작하기" 버튼이 나타납니다.

---

## 확인용 SQL (선택)

Supabase SQL Editor 에서 상태를 볼 수 있습니다.

```sql
-- 등록된 푸시 토큰 수
select count(*) from public.push_tokens;

-- 최근 본문
select date, ref, ai_generated from public.passages order by date desc limit 5;
```
