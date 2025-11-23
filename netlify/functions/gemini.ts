import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const handler: Handler = async (event) => {
  // DEBUG LOGS
  console.log("API key present?", !!process.env.GEMINI_API_KEY);
  console.log("Event body:", event.body);
  console.log("API key present?", !!process.env.GEMINI_API_KEY);

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };

  const { prompt } = JSON.parse(event.body || '{}');
  if (!prompt) return { statusCode: 400, body: 'Missing prompt' };

  try {
    const instruction = `Extract single or double or triple word concepts that best describe the academic topic tested in the question.
Return only the words, comma-separated, no bullets, no sentences, no extra text.
Question: ${prompt}`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: instruction,
    });

    const text = response.text as string;
    const keywords = text
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 3); // enforce hard limit

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


