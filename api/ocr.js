// api/ocr.js — Google Gemini Vision으로 티켓 OCR
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST만 허용'});

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if(!GEMINI_KEY) return res.status(500).json({error:'GEMINI_API_KEY 환경변수 미설정'});

  const { image, mediaType } = req.body;
  if(!image) return res.status(400).json({error:'image 필드 필요'});

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

    const body = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mediaType || 'image/jpeg',
              data: image
            }
          },
          {
            text: '한국 공연 티켓 사진입니다. 이미지에서 읽을 수 있는 공연 정보만 추출해 JSON으로 반환하세요. 형식: {"title":"공연명","date":"YYYY.MM.DD","time":"HH:MM","venue":"공연장","floor":"층구역","row":"열","seat":"번호","cast":"배우1, 배우2"} 규칙: 1) 마크다운 없이 JSON만 2) 읽을 수 없거나 없는 항목은 키 자체를 제외 (N/A 금지) 3) 날짜는 YYYY.MM.DD 형식'
          }
        ]
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 512 }
    };

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if(!upstream.ok) {
      const err = await upstream.text();
      console.error('[Gemini] 에러:', err);
      return res.status(upstream.status).json({error: err});
    }

    const data = await upstream.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[Gemini] 원문:', text);

    // JSON 추출
    const match = text.match(/\{[\s\S]*?\}/);
    if(!match) return res.status(200).json({error:'JSON 파싱 실패', raw: text});

    const obj = JSON.parse(match[0]);
    return res.status(200).json(obj);

  } catch(e) {
    console.error('[Gemini] 예외:', e);
    return res.status(500).json({error: e.message});
  }
}
