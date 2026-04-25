import { GoogleGenAI } from '@google/genai';
import { getSchemaDescription } from './database.js';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateSQL(question) {
    const schemaInfo = await getSchemaDescription();
    
    const prompt = \`
You are an expert SQL developer. Your task is to translate a natural language question into a valid SQL query.
Use the following SQLite database schema:

\${schemaInfo}

Translate this question into a single valid SQL query: "\${question}"

Respond ONLY with a JSON object in this exact format:
{
  "sql": "SELECT ...",
  "explanation": "A very brief 1-sentence explanation of what the query does."
}
No markdown formatting or extra text outside the JSON block. Let the JSON be raw.
\`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5',
            contents: prompt,
        });

        const rawText = response.text;
        // Clean up markdown block if the model still outputs one
        const cleanedText = rawText.replace(/\\`\\`\\`json/gi, '').replace(/\\`\\`\\`/gi, '').trim();
        const parsed = JSON.parse(cleanedText);
        
        return {
            sql: parsed.sql,
            explanation: parsed.explanation
        };
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("Failed to generate SQL from AI.");
    }
}
