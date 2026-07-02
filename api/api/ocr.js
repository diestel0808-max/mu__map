// api/ocr.js — Vercel에서 Tesseract 실행 (클라이언트 Worker 문제 없음)
import Tesseract from 'tesseract.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST만 허용'});

  const { image, mediaType } = req.body;
  if(!image) return res.status(400).json({error:'image 필드 필요'});

  try {
    // base64 → Buffer
    const buf = Buffer.from(image, 'base64');

    const result = await Tesseract.recognize(buf, 'kor+eng');
    const txt = result.data.text;
    console.log('[OCR] 원문:', txt.slice(0,200));

    const obj = {};

    // 날짜
    const dateMatch = txt.match(/(\d{2,4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if(dateMatch){
      const y = dateMatch[1].length===2 ? '20'+dateMatch[1] : dateMatch[1];
      obj.date = y+'.'+dateMatch[2].padStart(2,'0')+'.'+dateMatch[3].padStart(2,'0');
    }

    // 시간
    const timeMatch = txt.match(/(\d{1,2})[:시](\d{2})분?/);
    if(timeMatch) obj.time = timeMatch[1].padStart(2,'0')+':'+timeMatch[2];

    // 층/구역
    const floorMatch = txt.match(/([A-Z가-힣]?\d*[층석구역관])/);
    if(floorMatch) obj.floor = floorMatch[1];

    // 열
    const rowMatch = txt.match(/([A-Z]?\d+)열/);
    if(rowMatch) obj.row = rowMatch[1]+'열';

    // 번호
    const seatMatch = txt.match(/(\d+)\s*번/);
    if(seatMatch) obj.seat = seatMatch[1]+'번';

    // 공연장
    const venueMatch = txt.match(/([가-힣]+(?:씨어터|극장|홀|아트센터|센터|공연장)[\w가-힣]*)/);
    if(venueMatch) obj.venue = venueMatch[1];

    // 공연명
    const lines = txt.split('\n').map(l=>l.trim()).filter(l=>l.length>1);
    let titleFound = false;
    for(let i=0;i<lines.length;i++){
      if(/뮤지컬|연극|Musical|MUSICAL/.test(lines[i])){
        const next=lines[i+1];
        if(next&&/[가-힣]/.test(next)){obj.title=next;titleFound=true;break;}
      }
    }
    if(!titleFound){
      const korLines=lines.filter(l=>/[가-힣]/.test(l));
      if(korLines.length) obj.title=korLines.sort((a,b)=>b.length-a.length)[0];
    }

    return res.status(200).json(obj);
  } catch(e) {
    console.error('[OCR] 에러:', e);
    return res.status(500).json({error: e.message});
  }
}
