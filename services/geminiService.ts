
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to extract clean JSON from a model's response.
 * Handles cases where the model might wrap JSON in markdown blocks.
 */
function parseModelJson(text: string): any {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON from model response:", text);
    return null;
  }
}

/**
 * TASK 1-4: Automated B2B Lead Enrichment AI
 * Verifies data, finds social profiles, classifies industry, and scores readiness.
 */
export async function deepEnrichLead(lead: any): Promise<any> {
  try {
    const prompt = `You are a professional B2B lead enrichment AI specialized in finding authentic business data.
    
    Current Lead Information:
    - Company: "${lead.company_name}"
    - Website: "${lead.website || 'N/A'}"
    - Email: "${lead.email || 'N/A'}"
    - Source: "${lead.source}"

    Instructions:
    1. Search the internet (Google, LinkedIn, Instagram, Facebook, TikTok) to find the most accurate digital footprint for this business.
    2. Verify if the provided email "${lead.email}" is a valid business email.
    3. Find direct URLs for their Instagram, Facebook, LinkedIn, and TikTok profiles.
    4. Categorize the industry precisely.
    5. Calculate a "Lead Readiness Score" (0-100) based on their digital presence, contactability, and B2B relevance.

    You MUST return ONLY a JSON object with this exact structure:
    {
      "validated_email": boolean,
      "social_profiles": { 
        "instagram": "string or null", 
        "facebook": "string or null", 
        "linkedin": "string or null", 
        "tiktok": "string or null" 
      },
      "industry_category": "string",
      "lead_score": number,
      "explanation": "string (brief reasoning for the score)"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    return parseModelJson(response.text);
  } catch (error) {
    console.error("Enrichment AI Error:", error);
    return null;
  }
}

/**
 * GLOBAL PROSPECTOR: Crawl internet for new real leads.
 * Specifically looks for businesses with contact info and social presence.
 */
export async function prospectLeads(query: string): Promise<any[]> {
  try {
    const prompt = `Act as a world-class B2B Lead Generation Agent. 
    Your mission: Find 5 high-quality, 100% authentic businesses matching this search query: "${query}".
    
    Search targets: Google Maps, Instagram, LinkedIn, and major B2B directories (Alibaba, Kompass, etc.).
    Priority: Find businesses with a website, a verifiable email address, and active social media presence.
    
    Return ONLY a JSON array of objects with the following fields:
    [
      {
        "company_name": "string",
        "website": "string",
        "email": "string",
        "phone": "string",
        "location": "string",
        "industry": "string",
        "source": "string (e.g., 'Google Maps', 'Instagram', 'Alibaba')"
      }
    ]
    
    Ensure every lead has a 'source' specified. Do not include placeholders or fake data.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    const data = parseModelJson(response.text);
    return Array.isArray(data) ? data : (data.leads || []);
  } catch (error) {
    console.error("Prospecting AI Error:", error);
    return [];
  }
}

export async function getMarketInsights(leads: any[]): Promise<string> {
  if (!leads || leads.length === 0) return "No lead data available for analysis. Initiate a probe to begin.";
  
  try {
    const prompt = `Analyze this list of B2B leads and provide a sharp, one-sentence strategic insight for a sales director. Focus on quality, industry concentration, or contactability trends.
    Leads: ${JSON.stringify(leads.slice(0, 8))}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Market intelligence is currently being synthesized.";
  } catch (error) {
    return "Strategic analysis temporarily offline.";
  }
}
