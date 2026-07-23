import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';

import { colors, radius } from '../theme';
import type { MemberCard, StampKind } from '../types';
import { ShareDetail } from './MemberCard';

/**
 * 모자이크 타일을 탭하면 열리는 나눔 상세 바텀시트.
 * 내용은 가로 카드와 동일한 ShareDetail 을 재사용합니다.
 */
export function MemberDetailModal({
  card,
  myUserId,
  visible,
  onClose,
  onStamp,
  onComment,
}: {
  card: MemberCard | null;
  myUserId: string;
  visible: boolean;
  onClose: () => void;
  onStamp: (entryId: string, kind: StampKind | null) => void;
  onComment: (entryId: string, text: string) => Promise<void>;
}) {
  return (
    <Modal visible={visible && !!card} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,38,29,0.4)' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#f7f2ea',
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingTop: 12,
            height: '78%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#ddd2bd',
              alignSelf: 'center',
              marginBottom: 4,
            }}
          />
          {card && (
            <ShareDetail
              card={card}
              myUserId={myUserId}
              onClose={onClose}
              onStamp={onStamp}
              onComment={onComment}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
