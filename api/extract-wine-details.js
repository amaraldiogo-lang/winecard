export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ocrText } = req.body;

  if (!ocrText) {
    return res.status(400).json({ error: 'No OCR text provided' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Lê este texto extraído de um rótulo de vinho português.
Extrai APENAS a seguinte informação (se existir):
- Castas (variedades de uva): 
- Temperatura de serviço (ex: 14-16°C):
- Emparelhamento com comida (recomendações):
- Potencial de guarda (até que ano):

Se a informação não existir, deixa em branco.

Responde APENAS em JSON, sem texto extra:
{
  "castas": "",
  "temperatura": "",
  "emparelhamento": "",
  "guarda": ""
}

Texto do rótulo:
${ocrText}`
          }
        ]
      })
    });

    const data = await response.json();
    const claudeResponse = data.content[0].text;
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    const wineDetails = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return res.status(200).json({
      success: true,
      wineDetails: wineDetails
    });

  } catch (error) {
    console.error('Claude API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
