import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Empty, Field, Loading, Sans, Serif, TagLabel } from '../../src/components/ui';
import { generateDevotion, savePassage } from '../../src/lib/api';
import { dateKey, formatKoreanDate } from '../../src/lib/date';
import { notifyGroup } from '../../src/lib/notifications';
import { useSession } from '../../src/lib/session';
import { useBoard } from '../../src/lib/useBoard';
import { colors, radius } from '../../src/theme';

export default function AdminScreen() {
  const { activeGroup, userId, isLeader, profile } = useSession();
  const today = dateKey();
  const board = useBoard(activeGroup?.id ?? null, userId, today);

  const [date, setDate] = useState(today);
  const [ref, setRef] = useState('');
  const [verse, setVerse] = useState('');
  const [link, setLink] = useState('');
  const [devotion, setDevotion] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  // 이미 올린 본문이 있으면 폼을 채워 수정할 수 있게 합니다.
  useEffect(() => {
    if (!board.passage) return;
    setDate(board.passage.date);
    setRef(board.passage.ref);
    setVerse(board.passage.verse_text ?? '');
    setLink(board.passage.link_url ?? '');
    setDevotion(board.passage.devotion ?? '');
    setAiGenerated(board.passage.ai_generated);
  }, [board.passage]);

  if (!isLeader) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }} style={{ backgroundColor: colors.paper }}>
        <Serif style={{ fontSize: 19, color: colors.ink800 }}>관리자</Serif>
        <Empty
          title="리더만 볼 수 있는 화면이에요"
          hint="본문 등록은 소그룹 리더가 맡고 있어요"
        />
        {activeGroup && <InviteCard code={activeGroup.invite_code} name={activeGroup.name} />}
      </ScrollView>
    );
  }

  if (board.loading) return <Loading />;

  const writeAi = async () => {
    if (!ref.trim()) {
      Alert.alert('본문 범위를 먼저 적어주세요', '예: 다니엘 3:16–18');
      return;
    }
    setAiBusy(true);
    try {
      const out = await generateDevotion(ref, verse || null);
      setDevotion(out.devotion);
      if (!verse && out.verse_text) setVerse(out.verse_text);
      setAiGenerated(true);
    } catch (e) {
      Alert.alert(
        '묵상 글을 만들지 못했어요',
        `${e instanceof Error ? e.message : e}\n\nEdge Function(generate-devotion) 배포와 ANTHROPIC_API_KEY 설정을 확인해주세요.`,
      );
    } finally {
      setAiBusy(false);
    }
  };

  const publish = async () => {
    if (!activeGroup || !userId) return;
    if (!ref.trim()) {
      Alert.alert('본문 범위를 적어주세요');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('날짜 형식을 확인해주세요', 'YYYY-MM-DD 형식으로 적어주세요.');
      return;
    }
    setSaving(true);
    try {
      await savePassage({
        groupId: activeGroup.id,
        date,
        ref,
        verseText: verse,
        linkUrl: link,
        devotion,
        aiGenerated,
        userId,
      });
      setSavedOnce(true);
      await board.reload();
      notifyGroup({
        groupId: activeGroup.id,
        title: '오늘의 본문이 올라왔어요',
        body: `${ref} · ${profile?.name ?? '리더'}님이 올렸어요`,
        excludeUserId: userId,
      });
    } catch (e) {
      Alert.alert('올리지 못했어요', String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Serif style={{ fontSize: 19, color: colors.ink800 }}>관리자 대시보드</Serif>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.clay,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}
          >
            <Sans style={{ fontSize: 9, color: colors.clay }}>
              {profile?.name ?? '나'} · 리더
            </Sans>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#fffdf8',
            borderWidth: 1,
            borderColor: colors.lineWarm,
            borderRadius: radius.lg,
            padding: 18,
            marginTop: 16,
          }}
        >
          <Sans style={{ fontSize: 13, color: colors.ink700, marginBottom: 12 }}>
            오늘의 본문 올리기
          </Sans>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 9 }}>
            <Field
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={{ flex: 1, backgroundColor: colors.field, fontSize: 12 }}
            />
            <Field
              value={ref}
              onChangeText={setRef}
              placeholder="다니엘 3:16–18"
              style={{ flex: 1, backgroundColor: colors.field, fontSize: 12 }}
            />
          </View>
          <Sans style={{ fontSize: 11, color: colors.muted4, marginBottom: 9 }}>
            {/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatKoreanDate(date) : ' '}
          </Sans>

          <Field
            value={verse}
            onChangeText={setVerse}
            multiline
            serif
            placeholder="성경 구절 (그대로 보여집니다)"
            style={{
              backgroundColor: colors.field,
              fontSize: 13,
              height: 74,
              textAlignVertical: 'top',
              lineHeight: 24,
              marginBottom: 9,
            }}
          />

          <Field
            value={link}
            onChangeText={setLink}
            placeholder="관련 링크 (설교 영상 등)"
            autoCapitalize="none"
            keyboardType="url"
            style={{ backgroundColor: colors.field, fontSize: 12, marginBottom: 9 }}
          />

          <Field
            value={devotion}
            onChangeText={(t) => {
              setDevotion(t);
              setAiGenerated(false);
            }}
            multiline
            serif
            placeholder="묵상 안내 글을 적어주세요"
            style={{
              backgroundColor: colors.field,
              fontSize: 13,
              height: 96,
              textAlignVertical: 'top',
              lineHeight: 24,
            }}
          />
          {aiGenerated && (
            <Sans style={{ fontSize: 11, color: colors.label, marginTop: 6 }}>
              ✦ AI가 작성한 초안이에요. 손봐서 올려주세요.
            </Sans>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button
              variant="dashed"
              label={aiBusy ? '쓰는 중…' : devotion ? '✦ AI 다시 작성' : '✦ AI로 본문 작성'}
              onPress={writeAi}
              loading={aiBusy}
              style={{ paddingVertical: 10, paddingHorizontal: 13, borderRadius: 10 }}
            />
            <Button
              label={savedOnce ? '올렸어요 ✓' : board.passage ? '수정해서 올리기' : '소그룹에 올리기'}
              onPress={publish}
              loading={saving}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10 }}
            />
          </View>
        </View>

        {activeGroup && <InviteCard code={activeGroup.invite_code} name={activeGroup.name} />}

        <Sans style={{ fontSize: 13, color: colors.ink700, marginTop: 22, marginBottom: 10 }}>
          오늘 참여 현황 · {board.doneCount}/{board.total} 참여
        </Sans>
        {board.cards.map((c) => (
          <View
            key={c.userId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#fffdf8',
              borderWidth: 1,
              borderColor: colors.lineSoft,
              borderRadius: 14,
              paddingHorizontal: 13,
              paddingVertical: 11,
              marginBottom: 8,
            }}
          >
            <Avatar name={c.name} seed={c.userId} size={30} />
            <Sans style={{ flex: 1, fontSize: 13, color: colors.ink600 }}>{c.name}</Sans>
            <Sans style={{ fontSize: 12, color: c.entry ? colors.sage : colors.warn }}>
              {c.entry ? '나눔 완료' : '대기 중'}
            </Sans>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InviteCard({ code, name }: { code: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      style={{
        marginTop: 16,
        backgroundColor: colors.tint,
        borderWidth: 1,
        borderColor: colors.lineWarm,
        borderRadius: radius.lg,
        padding: 16,
      }}
    >
      <TagLabel>초대코드</TagLabel>
      <Serif style={{ fontSize: 26, letterSpacing: 6, color: colors.clay, marginTop: 6 }}>
        {code}
      </Serif>
      <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 6 }}>
        {copied ? '복사했어요!' : `탭하면 복사돼요 · ${name}에 초대할 때 알려주세요`}
      </Sans>
    </Pressable>
  );
}
