import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };

  const { prompt } = JSON.parse(event.body || '{}');
  if (!prompt) return { statusCode: 400, body: 'Missing prompt' };

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    const text = response.text; // already a string
    const keywords = text
      .split(/[,\n]/)
      .map((w: string) => w.trim())
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Gemini API error' }),
    };
  }
};