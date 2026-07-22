// AI 묵상 안내 글 생성 — Anthropic Claude API 호출
//
// 배포:
//   npx supabase functions deploy generate-devotion
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// 요청:  { ref: "다니엘 3:16–18", verse_text?: string }
// 응답:  { devotion: string, verse_text?: string }

const MODEL = 'claude-sonnet-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 로그인한 사용자만 쓸 수 있게 합니다.
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return json({ error: '로그인이 필요합니다' }, 401);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다' }, 500);

    const { ref, verse_text } = await req.json();
    if (!ref || typeof ref !== 'string') return json({ error: 'ref 가 필요합니다' }, 400);

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
      return json({ error: `Claude API 오류 (${res.status})`, detail }, 502);
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
