import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Group, MemberRole, Profile } from '../types';
import { supabase } from './supabase';

const ACTIVE_GROUP_KEY = 'danielqt.activeGroupId';

type Membership = { group: Group; role: MemberRole };

type SessionValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  activeGroup: Group | null;
  role: MemberRole | null;
  isLeader: boolean;
  userId: string | null;

  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithKakao: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;

  createGroup: (name: string) => Promise<Group>;
  joinGroup: (code: string) => Promise<Group>;
  setActiveGroup: (groupId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  const loadProfileAndGroups = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: rows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase
        .from('group_members')
        .select('role, groups(*)')
        .eq('user_id', uid)
        .order('joined_at', { ascending: true }),
    ]);

    setProfile((prof as Profile) ?? null);

    const list: Membership[] = ((rows ?? []) as any[])
      .filter((r) => r.groups)
      .map((r) => ({ group: r.groups as Group, role: r.role as MemberRole }));
    setMemberships(list);

    const stored = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
    const pick = list.find((m) => m.group.id === stored) ?? list[0];
    setActiveGroupId(pick?.group.id ?? null);
    return list;
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) await loadProfileAndGroups(data.session.user.id);
      if (alive) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!alive) return;
      setSession(next);
      if (next) {
        await loadProfileAndGroups(next.user.id);
        // 비밀번호 재설정 링크로 들어오면 새 비밀번호 화면으로 보냅니다.
        if (event === 'PASSWORD_RECOVERY') {
          try {
            router.replace('/reset-password');
          } catch {}
        }
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveGroupId(null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndGroups]);

  const refreshMemberships = useCallback(async () => {
    if (userId) await loadProfileAndGroups(userId);
  }, [userId, loadProfileAndGroups]);

  const setActiveGroup = useCallback(async (groupId: string) => {
    setActiveGroupId(groupId);
    await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw error;
      // 이메일 확인이 켜져 있으면 session 이 없습니다.
      if (!data.session) {
        throw new Error('가입 확인 메일을 보냈어요. 메일에서 인증 후 로그인해주세요.');
      }
    },
    [],
  );

  const signInWithKakao = useCallback(async () => {
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'danielqt', path: 'auth' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('카카오 로그인 주소를 받지 못했어요.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;

    // Supabase 는 #access_token=... 또는 ?code=... 로 돌려줍니다.
    const url = new URL(result.url);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');

    if (access_token && refresh_token) {
      const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
      if (e) throw e;
      return;
    }

    const code = url.searchParams.get('code');
    if (code) {
      const { error: e } = await supabase.auth.exchangeCodeForSession(code);
      if (e) throw e;
      return;
    }

    throw new Error('카카오 로그인 응답을 해석하지 못했어요.');
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
    await supabase.auth.signOut();
  }, []);

  const createGroup = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc('create_group', { group_name: name });
      if (error) throw error;
      const group = data as unknown as Group;
      await refreshMemberships();
      await setActiveGroup(group.id);
      return group;
    },
    [refreshMemberships, setActiveGroup],
  );

  const joinGroup = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc('join_group_by_code', {
        code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      const group = data as unknown as Group;
      await refreshMemberships();
      await setActiveGroup(group.id);
      return group;
    },
    [refreshMemberships, setActiveGroup],
  );

  const updateName = useCallback(
    async (name: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', userId);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, name: name.trim() } : p));
    },
    [userId],
  );

  const active = memberships.find((m) => m.group.id === activeGroupId) ?? null;

  const value = useMemo<SessionValue>(
    () => ({
      loading,
      session,
      profile,
      memberships,
      activeGroup: active?.group ?? null,
      role: active?.role ?? null,
      isLeader: active?.role === 'leader',
      userId,
      signInWithEmail,
      signUpWithEmail,
      signInWithKakao,
      resetPassword,
      signOut,
      createGroup,
      joinGroup,
      setActiveGroup,
      refreshMemberships,
      updateName,
    }),
    [
      loading,
      session,
      profile,
      memberships,
      active,
      userId,
      signInWithEmail,
      signUpWithEmail,
      signInWithKakao,
      resetPassword,
      signOut,
      createGroup,
      joinGroup,
      setActiveGroup,
      refreshMemberships,
      updateName,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>');
  return v;
}
