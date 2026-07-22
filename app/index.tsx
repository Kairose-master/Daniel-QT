import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '../src/lib/session';
import { colors } from '../src/theme';

export default function Gate() {
  const { loading, session, memberships } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  if (!session || memberships.length === 0) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
