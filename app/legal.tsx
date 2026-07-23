import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sans, Serif } from '../src/components/ui';
import { colors } from '../src/theme';

/**
 * 이용약관 / 개인정보처리방침. 스토어 심사에 필요한 최소 문서입니다.
 * 실제 서비스명·연락처를 맞게 고쳐 쓰세요. 외부 URL 이 준비되면 그쪽으로 대체해도 됩니다.
 */
export default function Legal() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isPrivacy = type === 'privacy';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Serif style={{ fontSize: 18, color: colors.ink800 }}>
          {isPrivacy ? '개인정보처리방침' : '이용약관'}
        </Serif>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Sans style={{ fontSize: 20, color: colors.muted5 }}>×</Sans>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }}>
        {(isPrivacy ? PRIVACY : TERMS).map((s, i) => (
          <View key={i} style={{ marginBottom: 20 }}>
            {s.h ? (
              <Serif style={{ fontSize: 15, color: colors.ink800, marginBottom: 8 }}>{s.h}</Serif>
            ) : null}
            <Sans style={{ fontSize: 13, lineHeight: 23, color: colors.ink500 }}>{s.b}</Sans>
          </View>
        ))}
        <Sans style={{ fontSize: 11, color: colors.muted4, marginTop: 8 }}>
          최종 업데이트: 2026-07-23
        </Sans>
      </ScrollView>
    </SafeAreaView>
  );
}

const TERMS = [
  {
    h: '제1조 (목적)',
    b: '이 약관은 "다니엘과 세친구"(이하 "서비스")가 제공하는 소그룹 큐티(QT) 나눔 기능의 이용 조건과 절차를 정합니다.',
  },
  {
    h: '제2조 (서비스 내용)',
    b: '서비스는 소그룹 단위로 성경 본문 묵상을 기록하고, 느낀점·기도제목·댓글·위로 스탬프·응원 음성을 나누는 기능을 제공합니다.',
  },
  {
    h: '제3조 (계정)',
    b: '이용자는 이메일 또는 소셜 로그인으로 계정을 만들고, 초대코드로 소그룹에 참여합니다. 계정 정보는 정확하게 유지해야 하며, 언제든 앱 내 "내 설정 > 계정 삭제"로 탈퇴할 수 있습니다.',
  },
  {
    h: '제4조 (이용자의 의무)',
    b: '이용자는 타인을 비방·모욕하거나 소그룹의 목적에 어긋나는 콘텐츠를 올리지 않아야 합니다. 위반 시 리더 또는 운영자가 콘텐츠를 삭제하거나 참여를 제한할 수 있습니다.',
  },
  {
    h: '제5조 (콘텐츠의 권리)',
    b: '이용자가 작성한 묵상·기도제목·음성 등의 저작권은 작성자에게 있습니다. 서비스는 소그룹 내 공유 목적으로만 이를 표시합니다.',
  },
  {
    h: '제6조 (면책)',
    b: '서비스는 소그룹 내 이용자 간에 공유되는 콘텐츠에 대해 책임을 지지 않으며, 천재지변·통신 장애 등 불가항력으로 인한 손해에 책임지지 않습니다.',
  },
];

const PRIVACY = [
  {
    h: '1. 수집하는 정보',
    b: '• 계정: 이메일, 이름(별명), 프로필 이미지(선택)\n• 활동: 묵상 글, 기도제목, 댓글, 위로 스탬프, 출석 기록\n• 응원 음성: 이용자가 직접 녹음해 전송한 오디오 파일\n• 알림: 푸시 알림 발송을 위한 기기 토큰',
  },
  {
    h: '2. 이용 목적',
    b: '수집한 정보는 소그룹 나눔 기능 제공, 참여 현황 집계, 푸시 알림 발송에만 사용합니다. 광고나 제3자 판매 목적으로 사용하지 않습니다.',
  },
  {
    h: '3. 보관과 파기',
    b: '정보는 서비스 이용 기간 동안 보관하며, 이용자가 계정을 삭제하면 관련 데이터(묵상·댓글·음성 등)가 함께 삭제됩니다. 소그룹에서 나가면 해당 소그룹에서의 접근 권한이 사라집니다.',
  },
  {
    h: '4. 제3자 처리',
    b: '서비스는 데이터 저장·인증을 위해 Supabase(클라우드 인프라)를 사용하며, 푸시 알림 발송을 위해 Expo 푸시 서비스를 사용합니다. 이들은 정보 처리를 위탁받은 수탁자이며, 목적 외 사용이 금지됩니다.',
  },
  {
    h: '5. 이용자의 권리',
    b: '이용자는 언제든 자신의 정보를 조회·수정할 수 있고, "내 설정 > 계정 삭제"로 모든 정보의 삭제를 요청할 수 있습니다.',
  },
  {
    h: '6. 문의',
    b: '개인정보 관련 문의는 소그룹 운영자 또는 앱 배포자에게 연락해 주세요. (배포 시 실제 연락처로 교체하세요.)',
  },
];
