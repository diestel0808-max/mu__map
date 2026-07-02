// api/ocr.js — Groq Vision으로 티켓 OCR (무료, 한국 지원)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST만 허용'});

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if(!GROQ_KEY) return res.status(500).json({error:'GROQ_API_KEY 환경변수 미설정'});

  const { image, mediaType } = req.body;
  if(!image) return res.status(400).json({error:'image 필드 필요'});

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 512,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType || 'image/jpeg'};base64,${image}`
              }
            },
            {
              type: 'text',
              text: '한국 공연 티켓 사진입니다. 이미지에서 읽을 수 있는 공연 정보만 추출해 JSON으로 반환하세요. 형식: {"title":"공연명","date":"YYYY.MM.DD","time":"HH:MM","venue":"공연장","floor":"층구역","row":"열","seat":"번호","cast":"배우1, 배우2"} 규칙: 1) 마크다운 없이 JSON만 2) 읽을 수 없거나 없는 항목은 키 자체를 제외 3) 날짜는 YYYY.MM.DD 형식'
            }
          ]
        }]
      })
    });

    if(!response.ok) {
      const err = await response.text();
      console.error('[Groq] 에러:', err);
      return res.status(response.status).json({error: err});
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log('[Groq] 원문:', text);

    const match = text.match(/\{[\s\S]*\}/);
    if(!match) return res.status(200).json({error:'JSON 파싱 실패', raw: text});

    const obj = JSON.parse(match[0]);
    return res.status(200).json(obj);

  } catch(e) {
    console.error('[Groq] 예외:', e);
    return res.status(500).json({error: e.message});
  }
}
