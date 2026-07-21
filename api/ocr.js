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
        // thinking 모드 비활성화 - <think> 태그 방지
        extra_body: { thinking: { type: 'disabled' } },
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
    const text = data.choices?.[0]?.message?.content || '';

    // <think>...</think> 태그 제거
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // JSON 추출
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    // JSON이 없으면 원문을 그대로 반환해서 클라이언트에서 볼 수 있게
    if(start === -1 || end === -1) {
      return res.status(200).json({
        error: 'JSON 없음',
        raw: cleaned.slice(0, 300),
        title: cleaned.slice(0, 50) // 혹시라도 텍스트가 있으면 title로
      });
    }

    const jsonStr = cleaned.slice(start, end+1);
    try {
      const obj = JSON.parse(jsonStr);
      return res.status(200).json(obj);
    } catch(e) {
      // 파싱 실패시 raw 텍스트도 같이 반환
      return res.status(200).json({
        error: 'JSON 파싱 실패',
        raw: jsonStr.slice(0, 300)
      });
    }

  } catch(e) {
    return res.status(500).json({error: e.message});
  }
}
