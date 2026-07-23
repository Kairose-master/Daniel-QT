// 계정 삭제 — 본인 요청으로 auth 사용자와 관련 데이터를 지웁니다.
// (클라이언트는 자신의 auth 계정을 지울 권한이 없어 service role 함수가 필요합니다.)
//
// 배포:
//   npx supabase functions deploy delete-account
//
// 앱에서: supabase.functions.invoke('delete-account')  (본인 토큰으로 호출)

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

    // 호출자 신원 확인 (본인만 자기 계정을 지울 수 있게)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me } = await asUser.auth.getUser();
    if (!me?.user) return json({ error: '로그인이 필요합니다' }, 401);
    const uid = me.user.id;

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 리더로 있는 소그룹은 남은 멤버에게 리더를 넘기거나, 혼자면 그룹째 삭제합니다.
    const { data: ledGroups } = await admin
      .from('groups')
      .select('id')
      .eq('leader_id', uid);

    for (const g of ledGroups ?? []) {
      const { data: others } = await admin
        .from('group_members')
        .select('user_id')
        .eq('group_id', g.id)
        .neq('user_id', uid)
        .limit(1);

      if (others && others.length > 0) {
        // 다른 멤버에게 리더 이양
        const heir = others[0].user_id;
        await admin.from('groups').update({ leader_id: heir }).eq('id', g.id);
        await admin
          .from('group_members')
          .update({ role: 'leader' })
          .eq('group_id', g.id)
          .eq('user_id', heir);
      } else {
        // 혼자였던 소그룹은 통째로 삭제 (cascade 로 하위 데이터 정리)
        await admin.from('groups').delete().eq('id', g.id);
      }
    }

    // 이 사용자가 올린 음성 파일도 Storage 에서 정리
    const { data: myVoices } = await admin
      .from('voice_messages')
      .select('storage_path')
      .eq('from_user_id', uid);
    const paths = (myVoices ?? []).map((v: { storage_path: string }) => v.storage_path);
    if (paths.length > 0) await admin.storage.from('voice').remove(paths);

    // auth 사용자 삭제 → profiles 및 나머지는 on delete cascade 로 정리됩니다.
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
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
