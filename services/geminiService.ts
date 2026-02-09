import { GoogleGenAI } from "@google/genai";
import { AggregatedSalesData } from "../types";

export const analyzeSalesData = async (data: AggregatedSalesData[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please configure the environment.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Format data for the prompt
  const summary = data.map(d => 
    `Rep: ${d.repName}, Target Net: ${d.targetSales - d.targetDeductions}, Beta Net: ${d.betaSales - d.betaDeductions}, Other Net: ${d.otherSales - d.otherDeductions}`
  ).join('\n');

  const prompt = `
  Analyze the following sales performance data for a sales team.
  Provide insights on:
  1. Top performing sales representative.
  2. Which category (Target, Beta, Other) is driving the most revenue.
  3. Any anomalies or underperformance.
  4. Suggestion for commission strategy based on the spread.

  Data:
  ${summary}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to connect to AI service.";
  }
};