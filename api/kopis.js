// api/kopis.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 캐시 방지
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const KOPIS_KEY = process.env.KOPIS_API_KEY;
  if (!KOPIS_KEY) return res.status(500).json({ error: 'KOPIS_API_KEY 환경변수가 설정되지 않았습니다.' });
  console.log('[KOPIS] KEY 존재:', !!KOPIS_KEY, '/ URL prefix: http://kopis.or.kr');

  const { path = 'pblprfr', url: posterUrl, ...params } = req.query;

  // 포스터 이미지 프록시 (CORS 우회)
  if(path === 'poster' && posterUrl){
    try{
      const imgRes = await fetch(posterUrl, {headers:{'User-Agent':'mumap-proxy/1.0'}});
      const buf = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(Buffer.from(buf));
    }catch(e){
      return res.status(502).json({error:'포스터 로드 실패: '+e.message});
    }
  }

  const ALLOWED_PATHS = ['pblprfr'];
  const safePath = ALLOWED_PATHS.find(p => path.startsWith(p)) ? path : 'pblprfr';
  const searchParams = new URLSearchParams({ ...params, service: KOPIS_KEY });
  const kopisUrl = `https://kopis.or.kr/openApi/restful/${safePath}?${searchParams}`;
  console.log("[KOPIS] 요청 URL:", kopisUrl.replace(KOPIS_KEY, "***"));

  try {
    const upstream = await fetch(kopisUrl, { headers: { 'User-Agent': 'mumap-proxy/1.0' } });
    const xml = await upstream.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(upstream.status).send(xml);
  } catch (e) {
    return res.status(502).json({ error: 'KOPIS 서버 연결 실패', detail: e.message });
  }
}
