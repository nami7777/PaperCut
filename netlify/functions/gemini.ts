import type { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { prompt } = JSON.parse(event.body || '{}');

  if (!prompt) {
    return { statusCode: 400, body: 'Missing prompt' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Gemini API error' }),
    };
  }
};