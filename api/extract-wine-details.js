import vision from '@google-cloud/vision';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid credentials format: ' + parseError.message
      });
    }

    const client = new vision.ImageAnnotatorClient({
      credentials: credentials
    });

    const base64Data = image.split(',')[1] || image;

    const request = {
      image: { content: base64Data },
      features: [{ type: 'TEXT_DETECTION' }]
    };

    const [result] = await client.annotateImage(request);
    const ocrText = result.fullTextAnnotation?.text || '';

    if (!ocrText || ocrText.trim().length < 5) {
      return res.status(200).json({
        success: false,
        message: 'Não consegui ler o rótulo'
      });
    }

    const lines = ocrText.split('\n').filter(l => l.trim().length > 1);
    const wineData = {
      name: '',
      year: null,
      region: '',
      type: 'Tinto'
    };

    for (const line of lines) {
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        wineData.year = parseInt(yearMatch[0]);
        break;
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 80 && !/^\d+$/.test(trimmed)) {
        wineData.name = trimmed;
        break;
      }
    }

    const textLower = ocrText.toLowerCase();
    if (textLower.includes('branco')) {
      wineData.type = 'Branco';
    } else if (textLower.includes('rosé') || textLower.includes('rosado')) {
      wineData.type = 'Rosé';
    }

    if (textLower.includes('douro')) {
      wineData.region = 'Douro';
    } else if (textLower.includes('setúbal')) {
      wineData.region = 'Setúbal';
    } else if (textLower.includes('alentejo')) {
      wineData.region = 'Alentejo';
    }

    return res.status(200).json({
      success: true,
      wineData: wineData,
      ocrText: ocrText
    });

  } catch (error) {
    console.error('Vision API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
}
