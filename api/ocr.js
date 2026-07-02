// api/ocr.js — Vercel Serverless Function
// Claude Vision API를 서버에서 호출 (API 키 노출 없음)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: 'image 필드가 필요합니다.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image,
              }
            },
            {
              type: 'text',
              text: '한국 공연 티켓 사진입니다. 이미지에서 읽을 수 있는 공연 정보만 추출해 JSON으로 반환하세요. 형식: {"title":"공연명","date":"YYYY.MM.DD","time":"HH:MM","venue":"공연장","floor":"층구역","row":"열","seat":"번호","cast":"배우1, 배우2"} 규칙: 1) 마크다운 없이 JSON만 2) 읽을 수 없거나 없는 항목은 키 자체를 제외 (N/A 금지) 3) 날짜는 YYYY.MM.DD 형식'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
