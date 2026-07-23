import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { colors } from '../theme';
import { Sans, Serif } from './ui';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * 화면에서 예외가 나도 앱 전체가 튕기지 않도록 잡아서 메시지를 보여줍니다.
 * (프로덕션 빌드에서 흰 화면/강제종료 대신 원인을 읽을 수 있게 합니다.)
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 개발 중에는 Metro 콘솔에도 남깁니다.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 14 }}
      >
        <Serif style={{ fontSize: 20, color: colors.danger }}>문제가 생겼어요</Serif>
        <Sans style={{ fontSize: 13, color: colors.ink600, lineHeight: 22 }}>
          이 화면을 그리는 중 오류가 났어요. 아래 내용을 알려주시면 고칠 수 있어요.
        </Sans>
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: colors.lineWarm,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Sans style={{ fontSize: 12, color: colors.danger, marginBottom: 6 }}>
            {error.name}: {error.message}
          </Sans>
          {error.stack ? (
            <Sans style={{ fontSize: 10, color: colors.muted, lineHeight: 16 }}>
              {error.stack.split('\n').slice(0, 8).join('\n')}
            </Sans>
          ) : null}
        </View>
        <Pressable
          onPress={this.reset}
          style={{
            backgroundColor: colors.clay,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Sans style={{ color: colors.white, fontSize: 14 }}>다시 시도</Sans>
        </Pressable>
      </ScrollView>
    );
  }
}
