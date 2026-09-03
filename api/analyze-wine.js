import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ocrText } = req.body;

  if (!ocrText) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const wineData = {
      vivinoRating: null,
      temperature: '',
      pairings: '',
      aging: ''
    };

    // Tenta extrair rating do Vivino (se recebeu nome)
    const lines = ocrText.split('\n');
    const possibleName = lines.find(l => l.length > 5 && l.length < 50);
    
    if (possibleName) {
      try {
        const searchUrl = `https://www.vivino.com/search?q=${encodeURIComponent(possibleName)}`;
        const { data: html } = await axios.get(searchUrl, {
          timeout: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Tenta extrair rating
        const ratingMatch = html.match(/data-average-rating["\']?\s*:\s*["']?([0-9.]+)/i);
        if (ratingMatch) {
          wineData.vivinoRating = parseFloat(ratingMatch[1]);
        }
      } catch (err) {
        console.log('Vivino search skipped');
      }
    }

    return res.status(200).json({
      success: true,
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
