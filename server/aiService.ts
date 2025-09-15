// AI-powered content enhancement service using OpenAI
import OpenAI from "openai";
import { JSDOM } from "jsdom";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EnhancedSummary {
  summary: string;
  keyRisks: string[];
  safetyRecommendations: string[];
  specificAreas: string[];
  lastUpdated: string;
}

export async function enhanceStateDeptSummary(
  originalSummary: string, 
  advisoryLink: string,
  countryName: string
): Promise<EnhancedSummary> {
  try {
    // Fetch the full advisory page content
    const pageContent = await fetchAdvisoryPageContent(advisoryLink);
    
    if (!pageContent) {
      // Fallback to original summary if page fetch fails
      return {
        summary: originalSummary,
        keyRisks: [],
        safetyRecommendations: [],
        specificAreas: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Use OpenAI to analyze and enhance the content
    const enhancedData = await analyzeAdvisoryContent(pageContent, countryName, originalSummary);
    
    return {
      ...enhancedData,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error enhancing State Dept summary:', error);
    
    // Return original summary on error
    return {
      summary: originalSummary,
      keyRisks: [],
      safetyRecommendations: [],
      specificAreas: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

async function fetchAdvisoryPageContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Global Advisor Bot/1.0)'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch advisory page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Parse HTML and extract main content
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove scripts, styles, navigation, and other non-content elements
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, .navigation, .sidebar, .ads');
    elementsToRemove.forEach(element => element.remove());
    
    // Try to find the main content area
    const mainContent = document.querySelector('main, .main-content, .content, .advisory-content, #main') || document.body;
    
    // Extract text content and clean it up
    let textContent = mainContent?.textContent || '';
    textContent = textContent
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim();
    
    return textContent;

  } catch (error) {
    console.error('Error fetching advisory page:', error);
    return null;
  }
}

async function analyzeAdvisoryContent(
  pageContent: string, 
  countryName: string, 
  originalSummary: string
): Promise<Omit<EnhancedSummary, 'lastUpdated'>> {
  
  // Truncate content if too long (GPT-5 has high token limits but we should be conservative)
  const maxContentLength = 15000;
  const truncatedContent = pageContent.length > maxContentLength 
    ? pageContent.substring(0, maxContentLength) + "..."
    : pageContent;

  const prompt = `
Analyze this US State Department travel advisory for ${countryName} and provide detailed, actionable information for travelers.

Original brief summary: "${originalSummary}"

Full advisory content:
${truncatedContent}

Please provide a comprehensive analysis in JSON format with these fields:
{
  "summary": "A detailed 2-3 paragraph summary that goes beyond just the threat level, including specific context about current conditions, regional variations, and practical implications for travelers",
  "keyRisks": ["List of 4-6 specific risks or threats mentioned, such as crime types, areas to avoid, health concerns, or political situations"],
  "safetyRecommendations": ["List of 4-6 specific safety recommendations and precautions travelers should take"],
  "specificAreas": ["List of specific cities, regions, or areas mentioned in the advisory with particular conditions or recommendations"]
}

Focus on extracting concrete, actionable information that would help travelers make informed decisions. Include specific details about crime patterns, safe areas, transportation safety, health precautions, and any special circumstances.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a travel safety expert who analyzes government travel advisories to provide detailed, practical guidance for travelers. Always respond with valid JSON."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent, factual responses
      max_completion_tokens: 1000 // GPT-5 uses max_completion_tokens instead of max_tokens
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate the response structure
    return {
      summary: result.summary || originalSummary,
      keyRisks: Array.isArray(result.keyRisks) ? result.keyRisks : [],
      safetyRecommendations: Array.isArray(result.safetyRecommendations) ? result.safetyRecommendations : [],
      specificAreas: Array.isArray(result.specificAreas) ? result.specificAreas : []
    };

  } catch (error) {
    console.error('Error analyzing advisory content with OpenAI:', error);
    
    // Return minimal enhancement on AI failure
    return {
      summary: originalSummary + " (Enhanced analysis temporarily unavailable)",
      keyRisks: [],
      safetyRecommendations: [],
      specificAreas: []
    };
  }
}

// Utility function to check if AI enhancement is available
export function isAIEnhancementAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}