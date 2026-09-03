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
    // ===== 1. OCR via API gratuita =====
    console.log('Starting OCR via API...');
    
    const formData = new FormData();
    // Converte base64 para blob
    const byteCharacters = atob(image.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    formData.append('filename', 'wine_label.jpg');
    formData.append('apikey', 'K87899142872957'); // Free tier key
    formData.append('language', 'por');
    
    // Usa fetch com FormData para enviar arquivo
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    const ocrResult = await ocrResponse.json();
    const ocrText = ocrResult.parsedText || '';
    
    console.log('OCR result:', ocrText.substring(0, 200));

    // ===== 2. Parse básico =====
    const lines = ocrText.split('\n').filter(l => l.trim().length > 2);
    const wineData = {
      name: '',
      year: null,
      region: '',
      grapes: '',
      type: 'Tinto',
      vivinoRating: null,
      temperature: '',
      aging: '',
      pairings: '',
      notes: ''
    };

    // Extrai ano
    for (const line of lines) {
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        wineData.year = parseInt(yearMatch[0]);
        break;
      }
    }

    // Primeira linha é geralmente o nome
    if (lines.length > 0) {
      wineData.name = lines[0].trim().substring(0, 50);
    }

    // Detecta tipo
    const textLower = ocrText.toLowerCase();
    if (textLower.includes('branco') || textLower.includes('white') || textLower.includes('blanco')) {
      wineData.type = 'Branco';
    } else if (textLower.includes('rosé') || textLower.includes('rosado')) {
      wineData.type = 'Rosé';
    }

    // Tenta detectar região
    if (textLower.includes('douro') || textLower.includes('doiro')) {
      wineData.region = 'Douro';
    } else if (textLower.includes('setúbal') || textLower.includes('setubal')) {
      wineData.region = 'Setúbal';
    } else if (textLower.includes('alentejo')) {
      wineData.region = 'Alentejo';
    } else if (textLower.includes('dão')) {
      wineData.region = 'Dão';
    }

    // ===== 3. Busca rápida no Vivino (sem web scraping complexo) =====
    if (wineData.name && wineData.year) {
      try {
        const searchUrl = `https://www.vivino.com/search?q=${encodeURIComponent(wineData.name + ' ' + wineData.year)}`;
        const { data: html } = await axios.get(searchUrl, {
          timeout: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Tenta extrair rating simples
        const ratingMatch = html.match(/data-average-rating["\']?\s*:\s*["']?([0-9.]+)/i);
        if (ratingMatch) {
          wineData.vivinoRating = parseFloat(ratingMatch[1]);
        }
      } catch (err) {
        console.log('Vivino search skipped (timeout)');
      }
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
