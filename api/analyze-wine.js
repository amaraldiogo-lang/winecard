import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wineInfo } = req.body;

  if (!wineInfo || !wineInfo.name) {
    return res.status(400).json({ error: 'Wine name required' });
  }

  try {
    const wineData = {
      name: wineInfo.name || '',
      year: wineInfo.year || null,
      region: wineInfo.region || '',
      type: wineInfo.type || 'Tinto',
      vivinoRating: null,
      grapes: wineInfo.grapes || '',
      temperature: wineInfo.temperature || '',
      aging: wineInfo.aging || '',
      pairings: wineInfo.pairings || ''
    };

    // Se tem nome e ano, busca no Vivino e Google
    if (wineData.name && wineData.year) {
      const searchQuery = `${wineData.name} ${wineData.year} wine vivino`;
      console.log('Searching:', searchQuery);

      try {
        // Busca no Vivino
        const vivinoUrl = `https://www.vivino.com/search?q=${encodeURIComponent(wineData.name + ' ' + wineData.year)}`;
        const { data: vivinoHtml } = await axios.get(vivinoUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Tenta extrair rating simples do HTML
        const ratingMatch = vivinoHtml.match(/(\d+\.\d+)[\s\D]*?rating/i);
        if (ratingMatch) {
          wineData.vivinoRating = parseFloat(ratingMatch[1]);
        }

        // Tenta detectar região
        if (vivinoHtml.includes('Douro')) wineData.region = wineData.region || 'Douro';
        if (vivinoHtml.includes('Setúbal') || vivinoHtml.includes('Setubal')) wineData.region = wineData.region || 'Setúbal';

      } catch (vivinoErr) {
        console.log('Vivino search timeout or error (não crítico)');
      }
    }

    return res.status(200).json({
      success: true,
      wineData: wineData
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
