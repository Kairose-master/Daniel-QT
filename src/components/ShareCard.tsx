import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, Switch, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { formatKoreanDate } from '../lib/date';
import { colors, radius } from '../theme';
import { LogoMark } from './LogoMark';
import { Button, Sans, Serif } from './ui';

/**
 * 내 묵상을 예쁜 카드 이미지로 만들어 공유합니다.
 * 기도제목은 내밀하므로 기본 제외하고, 담을지 토글로 고를 수 있습니다.
 */
export function ShareCardModal({
  visible,
  onClose,
  name,
  ref: passageRef,
  date,
  reflection,
  prayer,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  ref: string;
  date: string;
  reflection: string;
  prayer: string | null;
}) {
  const cardRef = useRef<View>(null);
  const [includePrayer, setIncludePrayer] = useState(false);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('공유를 사용할 수 없어요', '이 기기에서는 공유가 지원되지 않아요.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: '오늘의 묵상 나누기',
      });
    } catch (e) {
      Alert.alert('공유하지 못했어요', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,38,29,0.5)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#f7f2ea',
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            padding: 22,
            paddingBottom: 34,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#ddd2bd',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Serif style={{ fontSize: 18, color: colors.ink800 }}>카드로 나누기</Serif>
            <Pressable onPress={onClose} hitSlop={10}>
              <Sans style={{ fontSize: 20, color: colors.muted5 }}>×</Sans>
            </Pressable>
          </View>

          {/* 미리보기 = 실제로 캡처되는 카드 */}
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <View
              ref={cardRef}
              collapsable={false}
              style={{
                width: 320,
                backgroundColor: colors.paper,
                borderRadius: 24,
                padding: 26,
                borderWidth: 1,
                borderColor: colors.lineWarm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LogoMark size={26} />
                <Sans style={{ fontSize: 10, letterSpacing: 3, color: colors.labelSoft }}>
                  다니엘과 세친구
                </Sans>
              </View>

              <Serif style={{ fontSize: 20, color: colors.ink900, marginTop: 18 }}>
                {passageRef}
              </Serif>
              <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 3 }}>
                {formatKoreanDate(date)}
              </Sans>

              <Serif style={{ fontSize: 15, lineHeight: 27, color: colors.ink700, marginTop: 16 }}>
                “{reflection}”
              </Serif>

              {includePrayer && prayer ? (
                <View
                  style={{
                    marginTop: 16,
                    backgroundColor: colors.tint,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <Sans style={{ fontSize: 10, letterSpacing: 2, color: colors.label }}>기도제목</Sans>
                  <Sans style={{ fontSize: 12, lineHeight: 20, color: colors.ink500, marginTop: 4 }}>
                    {prayer}
                  </Sans>
                </View>
              ) : null}

              <View
                style={{
                  marginTop: 20,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.lineSoft,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Sans style={{ fontSize: 12, color: colors.ink500 }}>{name}님의 묵상</Sans>
                <Sans style={{ fontSize: 10, color: colors.muted4 }}>같은 말씀, 함께 걷는 하루</Sans>
              </View>
            </View>
          </View>

          {/* 기도제목 포함 토글 */}
          {prayer ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 18,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Sans style={{ fontSize: 13, color: colors.ink600 }}>기도제목도 넣기</Sans>
                <Sans style={{ fontSize: 11, color: colors.muted4, marginTop: 2 }}>
                  기도제목은 내밀할 수 있어요. 기본은 빼둡니다.
                </Sans>
              </View>
              <Switch
                value={includePrayer}
                onValueChange={setIncludePrayer}
                trackColor={{ true: colors.clay, false: colors.lineStrong }}
                thumbColor={colors.white}
              />
            </View>
          ) : null}

          <Button
            label="이미지로 공유하기"
            onPress={share}
            loading={busy}
            style={{ marginTop: 18, borderRadius: 14 }}
          />
        </View>
      </View>
    </Modal>
  );
}
