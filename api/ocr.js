// api/ocr.js — Groq Vision (qwen3.6-27b)
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
        model: 'qwen/qwen3.6-27b',
        max_tokens: 512,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` }
            },
            {
              type: 'text',
              text: '한국 공연 티켓 사진입니다. 읽을 수 있는 공연 정보만 추출해 JSON으로 반환하세요. 형식: {"title":"공연명","date":"YYYY.MM.DD","time":"HH:MM","venue":"공연장","floor":"층구역","row":"열","seat":"번호","cast":"배우1, 배우2"} 규칙: 마크다운 없이 JSON만, 없는 항목은 키 제외, N/A 금지'
            }
          ]
        }]
      })
    });

    if(!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({error: err});
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';

    // <think>...</think> 태그 제거 (중첩 포함, 탐욕적)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // 혹시 닫히지 않은 <think> 이후 내용도 제거
    const thinkStart = text.indexOf('<think>');
    if(thinkStart !== -1) text = text.slice(0, thinkStart);
    text = text.trim();

    // JSON 추출
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if(start === -1 || end === -1 || start >= end) {
      // JSON 없어도 빈 객체 반환 — 클라이언트에서 다음 단계로 넘어감
      return res.status(200).json({});
    }

    const jsonStr = text.slice(start, end+1);
    try {
      const obj = JSON.parse(jsonStr);
      return res.status(200).json(obj);
    } catch(e) {
      return res.status(200).json({});
    }

  } catch(e) {
    return res.status(500).json({error: e.message});
  }
}
