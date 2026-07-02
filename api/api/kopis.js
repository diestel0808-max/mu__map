// api/kopis.js — Vercel Serverless Function
// KOPIS API를 서버에서 호출해서 CORS 문제 우회

export default async function handler(req, res) {
  // CORS 헤더 — mumap이 올라갈 도메인으로 좁히는 걸 권장
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const KOPIS_KEY = process.env.KOPIS_API_KEY;
  if (!KOPIS_KEY) {
    return res.status(500).json({ error: 'KOPIS_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  // 쿼리 파라미터 그대로 전달 + service 키 주입
  const { path = 'pblprfr', ...params } = req.query;

  // 허용된 path만 통과 (보안)
  const ALLOWED_PATHS = ['pblprfr'];
  const safePath = ALLOWED_PATHS.find(p => path.startsWith(p)) ? path : 'pblprfr';

  const searchParams = new URLSearchParams({ ...params, service: KOPIS_KEY, newsql: 'Y' });
  const kopisUrl = `https://www.kopis.or.kr/openApi/restful/${safePath}?${searchParams}`;

  console.log('[KOPIS proxy] →', kopisUrl.replace(KOPIS_KEY, '***'));

  try {
    const upstream = await fetch(kopisUrl, {
      headers: { 'User-Agent': 'mumap-proxy/1.0' }
    });

    const xml = await upstream.text();

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(upstream.status).send(xml);
  } catch (e) {
    console.error('[KOPIS proxy] 에러:', e);
    return res.status(502).json({ error: 'KOPIS 서버 연결 실패', detail: e.message });
  }
}
