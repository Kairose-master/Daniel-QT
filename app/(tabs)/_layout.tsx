import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '../../src/components/LogoMark';
import { Avatar, Sans, Serif } from '../../src/components/ui';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

const TABS = [
  { name: 'index', label: '묵상', title: '오늘의 묵상' },
  { name: 'attend', label: '출석', title: '출석부' },
  { name: 'cheer', label: '응원함', title: '응원함' },
  { name: 'admin', label: '관리', title: '관리자' },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => <AppHeader title={options.title ?? ''} />,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarStyle: {
          backgroundColor: colors.paperWarm,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.muted4,
        tabBarLabelStyle: { fontFamily: 'GowunDodum_400Regular', fontSize: 11 },
        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: color,
              opacity: focused ? 1 : 0.35,
            }}
          />
        ),
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarLabel: t.label }}
        />
      ))}
    </Tabs>
  );
}

function AppHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeGroup, profile, userId } = useSession();

  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingBottom: 14,
        paddingHorizontal: 22,
        backgroundColor: colors.paper,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
        <LogoMark size={34} />
        <View style={{ flex: 1 }}>
          <Sans
            numberOfLines={1}
            style={{ fontSize: 11, letterSpacing: 3, color: colors.labelSoft }}
          >
            {activeGroup?.name ?? '소그룹'}
          </Sans>
          <Serif style={{ fontSize: 20, color: colors.ink800, marginTop: 2 }}>{title}</Serif>
        </View>
      </View>

      <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
        <Avatar name={profile?.name ?? '나'} seed={userId ?? 'me'} size={38} />
      </Pressable>
    </View>
  );
}
