import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    // Converte base64 para o formato que a API espera
    const base64Data = image.split(',')[1] || image;

    // Chama API de OCR gratuita
    const ocrResponse = await axios.post(
      'https://api.ocr.space/parse/image',
      {
        base64Image: `data:image/jpeg;base64,${base64Data}`,
        apikey: 'K87899142872957',
        language: 'por'
      },
      { timeout: 15000 }
    );

    const ocrText = ocrResponse.data.parsedText || '';

    if (!ocrText || ocrText.trim().length < 5) {
      return res.status(200).json({
        success: false,
        message: 'Não consegui ler o rótulo'
      });
    }

    // ===== Parse do texto =====
    const lines = ocrText.split('\n').filter(l => l.trim().length > 0);
    
    const wineData = {
      name: '',
      year: null,
      region: '',
      type: 'Tinto'
    };

    // Procura o ano (padrão: 19xx ou 20xx)
    for (const line of lines) {
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        wineData.year = parseInt(yearMatch[0]);
        break;
      }
    }

    // Procura o nome (geralmente a primeira linha legível ou antes da data)
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 3 && cleaned.length < 80 && !cleaned.match(/^\d+/) && !cleaned.match(/\.com|http|@/)) {
        if (!wineData.name || cleaned.length > wineData.name.length) {
          wineData.name = cleaned;
        }
      }
    }

    // Detecta tipo
    const textLower = ocrText.toLowerCase();
    if (textLower.includes('branco') || textLower.includes('white') || textLower.includes('blanco')) {
      wineData.type = 'Branco';
    } else if (textLower.includes('rosé') || textLower.includes('rosado') || textLower.includes('rose')) {
      wineData.type = 'Rosé';
    }

    // Tenta extrair região
    if (textLower.includes('douro') || textLower.includes('doiro')) {
      wineData.region = 'Douro';
    } else if (textLower.includes('setúbal') || textLower.includes('setubal')) {
      wineData.region = 'Setúbal';
    } else if (textLower.includes('alentejo')) {
      wineData.region = 'Alentejo';
    } else if (textLower.includes('dão') || textLower.includes('dao')) {
      wineData.region = 'Dão';
    } else if (textLower.includes('bairrada')) {
      wineData.region = 'Bairrada';
    }

    return res.status(200).json({
      success: true,
      ocrText: ocrText,
      wineData: wineData
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
