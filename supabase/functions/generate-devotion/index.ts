// AI 묵상 안내 글 생성 — 소그룹 리더가 등록한 본인 Anthropic 키로 호출합니다.
// (중앙 키를 쓰지 않아 배포자에게 과금이 몰리지 않습니다.)
//
// 배포:
//   npx supabase functions deploy generate-devotion
//   ※ ANTHROPIC_API_KEY 시크릿은 필요 없습니다. 키는 group_secrets 에 방마다 저장됩니다.
//
// 요청:  { group_id, ref, verse_text? }   (요청자 = 그 방 리더여야 함)
// 응답:  { devotion }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-sonnet-5';

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

    // 1) 요청자 신원 확인
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me } = await asUser.auth.getUser();
    if (!me?.user) return json({ error: '로그인이 필요합니다' }, 401);

    const { group_id, ref, verse_text } = await req.json();
    if (!group_id) return json({ error: 'group_id 가 필요합니다' }, 400);
    if (!ref || typeof ref !== 'string') return json({ error: 'ref 가 필요합니다' }, 400);

    // 2) 요청자가 그 방의 리더인지 확인 (리더만 AI 사용)
    const { data: membership } = await asUser
      .from('group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', me.user.id)
      .maybeSingle();
    if (!membership || membership.role !== 'leader') {
      return json({ error: '이 소그룹의 리더만 AI 본문을 생성할 수 있어요' }, 403);
    }

    // 3) 방에 저장된 키 조회 (service role — RLS 우회하되 위에서 리더 확인 완료)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: secret } = await admin
      .from('group_secrets')
      .select('anthropic_api_key')
      .eq('group_id', group_id)
      .maybeSingle();

    const apiKey = secret?.anthropic_api_key;
    if (!apiKey) {
      return json(
        { error: '관리 화면에서 Anthropic API 키를 먼저 등록해주세요.', code: 'NO_KEY' },
        400,
      );
    }

    const prompt = [
      `성경 본문: ${ref}`,
      verse_text ? `본문 인용: ${verse_text}` : null,
      '',
      '위 본문으로 소그룹 QT 나눔을 위한 "묵상 안내 글"을 써주세요.',
      '',
      '조건:',
      '- 한국어 존댓말, 3~4문장, 200자 내외.',
      '- 따뜻하고 잔잔한 톤. 과장된 표현이나 이모지는 쓰지 마세요.',
      '- 본문의 핵심을 한 줄로 짚고, 오늘 우리 삶에 비추어 묵상할 질문으로 마무리하세요.',
      '- 머리말("다음은…" 등) 없이 본문만 출력하세요.',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      // 키가 잘못됐을 때 알아보기 쉽게 안내
      const hint =
        res.status === 401
          ? '등록한 Anthropic API 키가 올바른지 확인해주세요.'
          : `Claude API 오류 (${res.status})`;
      return json({ error: hint, detail }, 502);
    }

    const data = await res.json();
    const devotion: string = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')
      .trim();

    if (!devotion) return json({ error: '빈 응답을 받았습니다' }, 502);

    return json({ devotion });
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
