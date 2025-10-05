// AI-powered content enhancement service using OpenAI
import OpenAI from "openai";
import { JSDOM } from "jsdom";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Timeout for API calls (30 seconds)
const API_TIMEOUT_MS = 30000;

interface EnhancedSummary {
  summary: string;
  keyRisks: string[];
  safetyRecommendations: string[];
  specificAreas: string[];
  threatLevel?: number; // 1-4, extracted from the advisory if available
  lastUpdated: string;
  aiApplied: boolean; // Flag to indicate if AI analysis actually occurred
}

/**
 * Utility function to add timeout to promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
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
      // Fallback: Try AI analysis of the base summary when full page isn't available
      try {
        if (originalSummary && originalSummary.length > 20) {
          const enhancedData = await analyzeBaseSummary(originalSummary, countryName);
          return {
            ...enhancedData,
            lastUpdated: new Date().toISOString(),
            aiApplied: true
          };
        }
      } catch (error) {
        // Fallback AI analysis failed, will return original
      }
      
      // If fallback AI also fails, return original - NO AI applied
      return {
        summary: originalSummary,
        keyRisks: [],
        safetyRecommendations: [],
        specificAreas: [],
        lastUpdated: new Date().toISOString(),
        aiApplied: false
      };
    }

    // Use OpenAI to analyze and enhance the content
    const enhancedData = await analyzeAdvisoryContent(pageContent, countryName, originalSummary);
    
    return {
      ...enhancedData,
      lastUpdated: new Date().toISOString()
      // aiApplied is already correctly set in enhancedData - don't override it
    };

  } catch (error) {
    console.error('Error enhancing State Dept summary:', error);
    
    // Return original summary on error - NO AI applied
    return {
      summary: originalSummary,
      keyRisks: [],
      safetyRecommendations: [],
      specificAreas: [],
      lastUpdated: new Date().toISOString(),
      aiApplied: false
    };
  }
}

async function analyzeBaseSummary(
  baseSummary: string, 
  countryName: string
): Promise<Omit<EnhancedSummary, 'lastUpdated'>> {
  const prompt = `
Analyze this US State Department travel advisory summary for ${countryName} and extract key information for travelers.

Travel Advisory Summary: "${baseSummary}"

Based on this summary, provide a JSON response with:
{
  "summary": "Expand this summary with 2-3 sentences providing context about travel conditions, safety considerations, and what travelers should know",
  "keyRisks": ["List 2-4 specific risks that can be inferred from this advisory level and summary"],
  "safetyRecommendations": ["List 2-4 practical safety recommendations appropriate for this travel advisory level"],
  "specificAreas": ["List any specific cities, regions, or areas mentioned or commonly relevant for ${countryName}"]
}

Focus on providing practical, actionable guidance even with limited information.
`;

  try {
    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a travel safety expert. Provide practical travel guidance based on government travel advisories. Respond with valid JSON."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      }),
      API_TIMEOUT_MS,
      `OpenAI API call for ${countryName} base summary`
    );

    const rawContent = response.choices[0].message.content || '{}';
    const result = JSON.parse(rawContent);
    
    // Validate and structure the response
    return {
      summary: result.summary || baseSummary,
      keyRisks: Array.isArray(result.keyRisks) ? result.keyRisks : [],
      safetyRecommendations: Array.isArray(result.safetyRecommendations) ? result.safetyRecommendations : [],
      specificAreas: Array.isArray(result.specificAreas) ? result.specificAreas : [],
      aiApplied: true
    };

  } catch (error) {
    console.error('Error analyzing base summary with OpenAI:', error);
    
    // Return original summary on AI failure
    return {
      summary: baseSummary,
      keyRisks: [],
      safetyRecommendations: [],
      specificAreas: [],
      aiApplied: false
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
      return null;
    }

    const html = await response.text();
    
    // Check for CAPTCHA protection
    const captchaIndicators = /recaptcha|grecaptcha|START CAPTCHA|captcha/i;
    if (captchaIndicators.test(html)) {
      return null;
    }
    
    // Check if page appears to be JavaScript-dependent or too short
    if (html.includes('window.location') || html.includes('document.createElement') || html.length < 1000) {
      return null;
    }
    
    // Parse HTML and extract main content
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove scripts, styles, navigation, and other non-content elements first
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, .navigation, .sidebar, .ads, .breadcrumb, .site-header, .site-footer, .skip-link, .menu, .navbar, #header, #footer, #navigation');
    elementsToRemove.forEach(element => element.remove());
    
    // Try multiple State Department specific strategies
    let mainContent: Element | null = null;
    let extractionMethod = 'unknown';
    
    // Strategy 1: Look for State Department specific content containers
    const stateDeptSelectors = [
      '.tsg-rwd-travel-advice-wrapper',
      '.tsg-rwd-content-main',  
      '.advisory-content',
      '.travel-advisory-content',
      '.content-wrapper',
      '.main-content-wrapper',
      '#main-content',
      '.page-content',
      '[data-component="travel-advisory"]'
    ];
    
    for (const selector of stateDeptSelectors) {
      mainContent = document.querySelector(selector);
      if (mainContent && mainContent.textContent && mainContent.textContent.length > 500) {
        extractionMethod = `selector: ${selector}`;
        break;
      }
    }
    
    // Strategy 2: Look for elements with travel advisory keywords and substantial content
    if (!mainContent || (mainContent.textContent && mainContent.textContent.length < 500)) {
      const allElements = Array.from(document.querySelectorAll('div, section, article, main, [role="main"]'));
      
      for (const element of allElements) {
        const text = element.textContent || '';
        if (text.length > 1000) { // Require substantial content
          const lowerText = text.toLowerCase();
          const keywordMatches = [
            lowerText.includes('travel advisory'),
            lowerText.includes('exercise caution'),
            lowerText.includes('security situation'),
            lowerText.includes('entry requirements'),
            lowerText.includes('local laws'),
            lowerText.includes('embassy'),
            lowerText.includes('crime'),
            lowerText.includes('terrorism'),
            lowerText.includes('demonstration'),
            lowerText.includes('health and safety')
          ].filter(Boolean).length;
          
          if (keywordMatches >= 3) { // Must match multiple keywords
            mainContent = element;
            extractionMethod = `keywords: ${keywordMatches} matches`;
            break;
          }
        }
      }
    }
    
    // Strategy 3: Look for the largest content block that seems meaningful
    if (!mainContent || (mainContent.textContent && mainContent.textContent.length < 500)) {
      const contentElements = Array.from(document.querySelectorAll('div, section, article'));
      let largestElement: Element | null = null;
      let largestSize = 0;
      
      for (const element of contentElements) {
        const text = element.textContent || '';
        if (text.length > largestSize && text.length > 1000) {
          // Avoid navigation-heavy content
          const navWords = (text.match(/home|about|contact|menu|navigation|footer|header/gi) || []).length;
          const contentRatio = navWords / (text.split(' ').length || 1);
          if (contentRatio < 0.1) { // Less than 10% navigation words
            largestElement = element;
            largestSize = text.length;
          }
        }
      }
      
      if (largestElement) {
        mainContent = largestElement;
        extractionMethod = `largest block: ${largestSize} chars`;
      }
    }
    
    // Fallback: use body but clean heavily
    if (!mainContent) {
      mainContent = document.body;
      extractionMethod = 'body fallback';
      
      // Remove more navigation and fluff elements
      const navElements = document.querySelectorAll('a[href*="travel.state.gov"], a[href*="home"], a[href*="about"], a[href*="contact"], a[href*="careers"], .site-navigation, .main-navigation, .footer, .header');
      navElements.forEach(element => element.remove());
    }
    
    // Extract and clean text content
    let textContent = mainContent?.textContent || '';
    
    textContent = textContent
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .replace(/Skip to main content/gi, '')  // Remove skip links
      .replace(/Travel\.State\.Gov/gi, '')  // Remove site branding
      .replace(/Home\|.*?\|/gi, '')  // Remove navigation breadcrumbs
      .replace(/Congressional Liaison.*?Contact Us/gi, '')  // Remove header navigation
      .replace(/Travel Advisories\s*\|\s*Newsroom/gi, '')  // Remove nav links
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
  "threatLevel": 1-4 (IMPORTANT: Extract the exact threat level number from the advisory. Look for phrases like "Level 1", "Level 2", "Level 3", or "Level 4" in the content. Return as a number 1-4. If not found, omit this field),
  "summary": "A detailed 2-3 paragraph summary that goes beyond just the threat level, including specific context about current conditions, regional variations, and practical implications for travelers",
  "keyRisks": ["List of 4-6 specific risks or threats mentioned, such as crime types, areas to avoid, health concerns, or political situations"],
  "safetyRecommendations": ["List of 4-6 specific safety recommendations and precautions travelers should take"],
  "specificAreas": ["List of specific cities, regions, or areas mentioned in the advisory with particular conditions or recommendations"]
}

Focus on extracting concrete, actionable information that would help travelers make informed decisions. Include specific details about crime patterns, safe areas, transportation safety, health precautions, and any special circumstances.
`;

  try{
    // Use a working model with structured outputs for reliable results
    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Use gpt-4o-mini which is known to work reliably with structured outputs
        messages: [
          {
            role: "system",
            content: "You are a travel safety expert who analyzes government travel advisories. Respond with valid JSON that provides detailed, practical guidance for travelers."
          },
          {
            role: "user", 
            content: `Analyze this US State Department travel advisory for ${countryName} and provide detailed, actionable information.

Original summary: "${originalSummary}"

Full advisory content:
${truncatedContent}

Provide a comprehensive analysis in JSON format with:
- threatLevel: IMPORTANT: Extract the exact threat level number (1-4) from the advisory. Look for "Level 1", "Level 2", "Level 3", or "Level 4" in the content. Return as a number. If not found, omit this field.
- summary: A detailed 2-3 paragraph summary that goes beyond just the threat level
- keyRisks: Array of 3-6 specific risks or threats mentioned  
- safetyRecommendations: Array of 3-6 specific safety recommendations
- specificAreas: Array of specific cities, regions, or areas mentioned`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      }),
      API_TIMEOUT_MS,
      `OpenAI API call for ${countryName} full advisory`
    );

    // Extract JSON content from chat completions response
    const rawContent = response.choices[0].message.content || '{}';
    const result = JSON.parse(rawContent);
    
    // Validate that essential fields are present - be flexible with arrays
    if (!result.summary || result.summary.length < 20) {
      result.summary = originalSummary; // Fallback to original
    }
    
    // Validate threat level if provided
    const extractedThreatLevel = typeof result.threatLevel === 'number' && 
                                  result.threatLevel >= 1 && 
                                  result.threatLevel <= 4 
                                    ? result.threatLevel 
                                    : undefined;
    
    // Return structured result
    return {
      summary: result.summary || originalSummary,
      keyRisks: Array.isArray(result.keyRisks) ? result.keyRisks : [],
      safetyRecommendations: Array.isArray(result.safetyRecommendations) ? result.safetyRecommendations : [],
      specificAreas: Array.isArray(result.specificAreas) ? result.specificAreas : [],
      threatLevel: extractedThreatLevel,
      aiApplied: true // AI analysis was successfully applied
    };

  } catch (error) {
    console.error('Error analyzing advisory content with OpenAI:', error);
    
    // Return original summary on AI failure - NO AI applied, no user-facing error message
    return {
      summary: originalSummary,
      keyRisks: [],
      safetyRecommendations: [],
      specificAreas: [],
      aiApplied: false
    };
  }
}

// Utility function to check if AI enhancement is available
export function isAIEnhancementAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}