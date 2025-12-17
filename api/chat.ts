
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Gemini Client server-side
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!ai) {
    return res.status(500).json({ message: 'API Key server configuration missing.' });
  }

  try {
    const { model, contents, config } = req.body;

    // Set headers for SSE (Server-Sent Events) / Streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-transform',
    });

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: contents,
      config: config,
    });

    for await (const chunk of responseStream) {
      // We send the raw text of the chunk or a JSON structure if needed.
      // To keep it compatible with the frontend expecting GenerateContentResponse objects,
      // we will serialize the relevant parts of the chunk.
      
      const chunkData = JSON.stringify({
        text: chunk.text,
        candidates: chunk.candidates,
        usageMetadata: chunk.usageMetadata
      });
      
      res.write(chunkData + '\n__GEMINI_CHUNK__\n');
    }

    res.end();

  } catch (error) {
    console.error('Gemini API Error:', error);
    // If headers are already sent, we can't send a JSON error response cleanly, 
    // but we can try to send an error chunk.
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.write(JSON.stringify({ error: errorMessage }) + '\n__GEMINI_CHUNK__\n');
    res.end();
  }
}
