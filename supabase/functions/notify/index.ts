// 소그룹 푸시 알림 발송 — Expo Push API
//
// 배포:
//   npx supabase functions deploy notify
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동 주입합니다)
//
// 요청: { groupId, title, body, excludeUserId?, toUserId? }
//   toUserId 를 주면 그 사람에게만, 없으면 소그룹 전체에게(excludeUserId 제외) 보냅니다.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: '로그인이 필요합니다' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) 호출자가 정말 그 소그룹 멤버인지 사용자 토큰으로 확인합니다.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me } = await asUser.auth.getUser();
    if (!me?.user) return json({ error: '로그인이 필요합니다' }, 401);

    const { groupId, title, body, excludeUserId, toUserId } = await req.json();
    if (!groupId || !title || !body) return json({ error: '필수 값이 빠졌습니다' }, 400);

    const { data: membership } = await asUser
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', me.user.id)
      .maybeSingle();
    if (!membership) return json({ error: '이 소그룹의 멤버가 아닙니다' }, 403);

    // 2) 토큰 조회는 service role 로 (RLS 는 본인 것만 허용)
    const admin = createClient(url, serviceKey);

    let recipients: string[];
    if (toUserId) {
      recipients = [toUserId];
    } else {
      const { data: members } = await admin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);
      recipients = (members ?? [])
        .map((m: { user_id: string }) => m.user_id)
        .filter((id: string) => id !== excludeUserId);
    }
    if (recipients.length === 0) return json({ sent: 0 });

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .in('user_id', recipients);

    const messages = (tokens ?? []).map((t: { token: string }) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
    }));
    if (messages.length === 0) return json({ sent: 0 });

    // Expo Push API 는 한 번에 100개까지 받습니다.
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }

    return json({ sent: messages.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
