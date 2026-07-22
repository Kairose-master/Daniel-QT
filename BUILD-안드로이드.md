# 안드로이드 폰에 설치하기

APK를 만들어 폰에 직접 설치하는 순서입니다. 클라우드(EAS)에서 빌드하므로
Android Studio나 JDK를 깔 필요가 없습니다.

터미널에서 `C:\Users\장진우\Downloads\daniel-qt-app` 폴더로 이동한 뒤 순서대로 하세요.

---

## 1. Expo 계정 만들고 로그인 (최초 1회)

계정이 없으면 https://expo.dev/signup 에서 무료로 가입합니다.

```
npx eas login
```

이메일과 비밀번호를 물어봅니다. 확인:

```
npx eas whoami
```

## 2. EAS 프로젝트 연결 (최초 1회)

```
npx eas init
```

- "Would you like to create a project?" -> **Yes**
- 프로젝트 이름은 그대로 두면 됩니다

성공하면 `app.json` 의 `extra.eas.projectId` 가 자동으로 채워집니다.
이 값이 있어야 **푸시 알림 토큰**이 발급됩니다.

## 3. Supabase 값을 EAS에 등록 (최초 1회)

로컬 `.env` 는 `.gitignore` 에 있어서 빌드 서버로 올라가지 않습니다.
그래서 EAS 쪽에 따로 등록해야 합니다.

**방법 A - 웹 대시보드 (쉬움, 권장)**

1. https://expo.dev 로그인 -> 방금 만든 프로젝트 선택
2. 왼쪽 메뉴 **Environment variables** -> **Create variable**
3. 아래 두 개를 각각 등록. Visibility 는 **Plain text**,
   Environments 는 **preview** 와 **production** 둘 다 체크

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` 파일의 같은 이름 값 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` 파일의 같은 이름 값 |

**방법 B - 명령어**

`<값>` 자리에 `.env` 의 값을 그대로 넣으세요.

```
npx eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "<값>" --environment preview --visibility plaintext --scope project --non-interactive
npx eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<값>" --environment preview --visibility plaintext --scope project --non-interactive
```

## 4. 빌드

```
npm run build:android
```

- 안드로이드 키스토어를 만들지 물어보면 **Yes** (EAS가 알아서 만들고 보관합니다)
- 15~25분 걸립니다. 진행 상황은 터미널 링크나 expo.dev 에서 볼 수 있습니다

## 5. 폰에 설치

빌드가 끝나면 터미널에 **QR 코드와 다운로드 링크**가 나옵니다.

1. 폰으로 QR을 찍거나 링크를 엽니다
2. APK를 내려받습니다
3. "출처를 알 수 없는 앱" 설치를 허용합니다
   (설정 -> 앱 -> 특별한 앱 접근 -> 알 수 없는 앱 설치 -> 브라우저 허용)
4. 설치 후 실행

이제 **음성 녹음과 푸시 알림까지 전부 동작**합니다. PC를 꺼도 됩니다.

---

## 소그룹 지체들에게 나눠주기

같은 다운로드 링크를 그대로 공유하면 됩니다. 링크는 만료되지 않습니다.
각자 설치한 뒤, 앱에서 **초대코드**(관리 탭 또는 내 설정에 있음)를 입력하면 참여됩니다.

지체 수가 많거나 계속 업데이트할 예정이면 나중에 Google Play **내부 테스트**로
올리는 편이 낫습니다 (등록비 $25, 1회).

---

## 코드를 고친 뒤 다시 빌드할 때

1~3번은 건너뛰고 `npm run build:android` 만 다시 실행하면 됩니다.

---

## 자주 나오는 문제

**"Invalid API key" 또는 로그인이 안 됨**
-> 3번의 환경변수가 `preview` 환경에 등록됐는지 확인하세요. 등록 후 다시 빌드해야 반영됩니다.

**빌드는 됐는데 앱이 "연결 설정이 필요해요" 화면**
-> 같은 원인입니다. 3번을 확인하고 재빌드하세요.

**푸시 알림이 안 옴**
-> `app.json` 의 `extra.eas.projectId` 가 비어있으면 토큰이 발급되지 않습니다.
   `npx eas init` 을 다시 실행하고 재빌드하세요.
   그리고 Edge Function 배포도 필요합니다: `npx supabase functions deploy notify`
