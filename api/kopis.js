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

  // 지오코딩 프록시 (공연장 이름 → 좌표, OpenStreetMap Nominatim 사용, KOPIS 서비스키 불필요)
  if(path === 'geocode'){
    const { q } = kopisParams;
    if(!q) return res.status(400).json({ error: 'q(검색어) 필요' });
    try{
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(q)}`;
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 4000);
      let r;
      try{
        r = await fetch(geoUrl, { headers: { 'User-Agent': 'mu-map-ticketbook/1.0 (contact: mu-map-app@example.com)' }, signal: ctrl.signal });
      }finally{ clearTimeout(t); }
      const data = await r.json();
      console.log('[GEOCODE]', q, '->', JSON.stringify(data).slice(0,150));
      if(!Array.isArray(data) || !data.length) return res.status(200).json({});
      return res.status(200).json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    }catch(e){
      return res.status(502).json({ error: 'geocode 실패: ' + e.message });
    }
  }

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

  // KOPIS API 호출
  const basePath = path.split('/')[0];
  const isKnownBase = basePath === 'pblprfr' || basePath === 'prfplc';
  const safePath = isKnownBase ? path : 'pblprfr';
  const isDetail = /^(pblprfr|prfplc)\/.+/.test(safePath); // 상세조회는 /pblprfr/{mt20id} 또는 /prfplc/{mt10id}

  let kopisUrl;
  if (isDetail) {
    // 상세조회는 stdate/eddate 불필요
    kopisUrl = `https://kopis.or.kr/openApi/restful/${safePath}?service=${KOPIS_KEY}`;
  } else if (basePath === 'prfplc') {
    // 공연시설 목록 검색 (시설명으로 좌표 조회 등) — stdate/eddate 불필요, cpage/rows만 필수
    const { cpage = '1', rows = '10', shprfnmfct } = kopisParams;
    kopisUrl = `https://kopis.or.kr/openApi/restful/prfplc?service=${KOPIS_KEY}&cpage=${cpage}&rows=${rows}`;
    if(shprfnmfct){
      kopisUrl += `&shprfnmfct=${encodeURIComponent(shprfnmfct)}`;
    }
  } else {
    const { stdate, eddate, cpage = '1', rows = '20', shprfnm, shcate } = kopisParams;
    if(!stdate || !eddate){
      return res.status(400).json({ error: 'stdate, eddate 필요' });
    }
    // KOPIS 목록조회는 cpage, rows가 필수 파라미터 (없으면 INVALID REQUEST PARAMETER ERROR 발생)
    kopisUrl = `https://kopis.or.kr/openApi/restful/${safePath}?service=${KOPIS_KEY}&stdate=${stdate}&eddate=${eddate}&cpage=${cpage}&rows=${rows}`;
    // shprfnm(제목)이 있으면 KOPIS 서버측 검색 필터로 추가 — 반드시 encodeURIComponent로 재인코딩
    if(shprfnm){
      kopisUrl += `&shprfnm=${encodeURIComponent(shprfnm)}`;
    }
    // shcate(장르코드, 예: GGGA=뮤지컬)가 있으면 장르 필터 추가
    if(shcate){
      kopisUrl += `&shcate=${encodeURIComponent(shcate)}`;
    }
  }
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
