
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

export class GeminiService {
  /**
   * Isolates the object (e.g., earring) from the background.
   * We ask Gemini to precisely isolate the object and place it on a pure white background.
   * This solid background is then converted to transparency in the frontend.
   */
  async removeBackground(base64Image: string, customPrompt?: string): Promise<string | null> {
    // Initialize AI client right before the request using the environment API key to ensure the latest key is used.
    const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_API_KEY });

    const defaultPrompt = "Isolate the main object in this image. Remove all background elements completely. Place the isolated subject on a PURE SOLID WHITE (#FFFFFF) background. DO NOT use any other colors for the background. DO NOT render a checkerboard, grid, or tiled pattern. DO NOT include any shadows or supporting props. Return ONLY the isolated subject on solid white as a high-quality PNG.";
    const finalPrompt = customPrompt || defaultPrompt;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image.split(',')[1],
                mimeType: 'image/png',
              },
            },
            {
              text: finalPrompt,
            },
          ],
        },
      });

      // Iterate through response parts to find the image data.
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  }
}
