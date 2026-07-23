// api/kopis.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KOPIS_KEY = process.env.KOPIS_API_KEY;
  if (!KOPIS_KEY) return res.status(500).json({ error: 'KOPIS_API_KEY 미설정' });

  const { path = 'pblprfr', url: posterUrl, ...rest } = req.query;

  // posterUrl에서 path, url 제거하고 나머지만 KOPIS에 전달
  const { path: _p, url: _u, ...kopisParams } = rest;

  console.log('[KOPIS] path:', path, '/ params:', JSON.stringify(kopisParams));

  // 포스터 프록시
  if(path === 'poster' && posterUrl){
    try{
      const imgRes = await fetch(posterUrl, { headers: { 'User-Agent': 'mumap/1.0' } });
      const buf = await imgRes.arrayBuffer();
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      return res.status(200).send(Buffer.from(buf));
    }catch(e){
      return res.status(502).json({ error: '포스터 로드 실패: ' + e.message });
    }
  }

  // KOPIS API 호출 - stdate, eddate만 전달
  const { stdate, eddate } = kopisParams;
  if(!stdate || !eddate){
    return res.status(400).json({ error: 'stdate, eddate 필요' });
  }

  const safePath = path.startsWith('pblprfr') ? path : 'pblprfr';
  const kopisUrl = `https://kopis.or.kr/openApi/restful/${safePath}?service=${KOPIS_KEY}&stdate=${stdate}&eddate=${eddate}`;
  console.log('[KOPIS] URL:', kopisUrl.replace(KOPIS_KEY, '***'));

  try {
    const upstream = await fetch(kopisUrl, { headers: { 'User-Agent': 'mumap/1.0' } });
    const xml = await upstream.text();
    console.log('[KOPIS] 응답 앞부분:', xml.slice(0, 150));
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch(e) {
    console.error('[KOPIS] fetch 에러:', e.message);
    return res.status(502).json({ error: 'KOPIS 연결 실패: ' + e.message });
  }
}
