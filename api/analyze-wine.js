import Tesseract from 'tesseract.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    // ===== 1. OCR - Extrair texto do rótulo =====
    console.log('Starting OCR...');
    const { data: { text } } = await Tesseract.recognize(image, 'por+eng');
    console.log('OCR result:', text.substring(0, 200));

    // ===== 2. Parse básico do OCR =====
    const lines = text.split('\n').filter(l => l.trim().length > 0);
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

    // Tenta extrair ano (padrão: 4 dígitos entre 1900-2100)
    for (const line of lines) {
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        wineData.year = parseInt(yearMatch[0]);
        break;
      }
    }

    // Primeira linha geralmente é o nome
    if (lines.length > 0) {
      wineData.name = lines[0].trim();
    }

    // ===== 3. Web Search - Buscar dados do vinho =====
    if (wineData.name && wineData.year) {
      const searchQuery = `${wineData.name} ${wineData.year} portugal wine`;
      console.log('Searching:', searchQuery);

      try {
        // Busca no Google (result simples)
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        const { data: html } = await axios.get(googleUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(html);

        // Tenta extrair info básica de snippets de search
        const snippets = $('div.VwiC3b span').text();
        if (snippets) {
          // Se encontrar "temperature", "region", etc - adiciona
          if (snippets.toLowerCase().includes('douro')) {
            wineData.region = 'Douro';
          } else if (snippets.toLowerCase().includes('setúbal') || snippets.toLowerCase().includes('setubal')) {
            wineData.region = 'Setúbal';
          }
        }
      } catch (searchErr) {
        console.log('Search error (não crítico):', searchErr.message);
        // Continua mesmo que search falhe
      }

      // ===== 4. Buscar no Vivino =====
      try {
        const vivinoUrl = `https://www.vivino.com/search?q=${encodeURIComponent(wineData.name)}`;
        const { data: vivinoHtml } = await axios.get(vivinoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $viv = cheerio.load(vivinoHtml);

        // Tenta extrair rating do primeiro resultado
        const ratingText = $viv('div.vintageTitle__rating').first().text();
        if (ratingText) {
          const ratingMatch = ratingText.match(/[\d.]+/);
          if (ratingMatch) {
            wineData.vivinoRating = parseFloat(ratingMatch[0]);
          }
        }

        // Tenta extrair região, tipo, etc do HTML Vivino
        const detailsText = $viv('div.wineDetails').text();
        if (detailsText.includes('Tinto')) wineData.type = 'Tinto';
        else if (detailsText.includes('Branco')) wineData.type = 'Branco';
        else if (detailsText.includes('Rosé')) wineData.type = 'Rosé';

      } catch (vivinoErr) {
        console.log('Vivino search error (não crítico):', vivinoErr.message);
      }
    }

    // ===== 5. Retorna resultado =====
    return res.status(200).json({
      success: true,
      ocrText: text,
      wineData: wineData
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      ocrText: ''
    });
  }
}
