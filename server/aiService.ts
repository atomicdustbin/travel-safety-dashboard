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
  aiApplied: boolean; // Flag to indicate if AI analysis actually occurred
}

export async function enhanceStateDeptSummary(
  originalSummary: string, 
  advisoryLink: string,
  countryName: string
): Promise<EnhancedSummary> {
  try {
    // Fetch the full advisory page content
    const pageContent = await fetchAdvisoryPageContent(advisoryLink);
    console.log(`[DEBUG] Page content length for ${countryName}:`, pageContent?.length || 0);
    console.log(`[DEBUG] Page content preview for ${countryName}:`, pageContent?.substring(0, 200) || 'NO CONTENT');
    
    if (!pageContent) {
      console.log(`[DEBUG] No page content fetched for ${countryName}, using fallback`);
      // Fallback to original summary if page fetch fails - NO AI applied
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

async function fetchAdvisoryPageContent(url: string): Promise<string | null> {
  try {
    console.log(`[DEBUG] Fetching URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Global Advisor Bot/1.0)'
      }
    });

    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.warn(`Failed to fetch advisory page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`[DEBUG] Raw HTML length: ${html.length}`);
    console.log(`[DEBUG] Raw HTML preview: ${html.substring(0, 500)}`);
    
    // Check for CAPTCHA protection
    const captchaIndicators = /recaptcha|grecaptcha|START CAPTCHA|captcha/i;
    if (captchaIndicators.test(html)) {
      console.warn(`[DEBUG] CAPTCHA detected in page - skipping content extraction`);
      return null;
    }
    
    // Check if page appears to be JavaScript-dependent or too short
    if (html.includes('window.location') || html.includes('document.createElement') || html.length < 1000) {
      console.warn(`[DEBUG] Page may be JavaScript-dependent or redirecting`);
    }
    
    // Parse HTML and extract main content
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Save HTML for debugging if needed
    if (html.length > 100000) {
      console.log(`[DEBUG] Large HTML detected (${html.length} chars) - analyzing structure`);
    }
    
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
        console.log(`[DEBUG] Found content using ${extractionMethod}`);
        break;
      }
    }
    
    // Strategy 2: Look for elements with travel advisory keywords and substantial content
    if (!mainContent || (mainContent.textContent && mainContent.textContent.length < 500)) {
      console.log(`[DEBUG] Trying keyword-based content detection`);
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
            console.log(`[DEBUG] Found content using ${extractionMethod}, length: ${text.length}`);
            break;
          }
        }
      }
    }
    
    // Strategy 3: Look for the largest content block that seems meaningful
    if (!mainContent || (mainContent.textContent && mainContent.textContent.length < 500)) {
      console.log(`[DEBUG] Trying largest content block strategy`);
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
        console.log(`[DEBUG] Found content using ${extractionMethod}`);
      }
    }
    
    // Fallback: use body but clean heavily
    if (!mainContent) {
      console.log(`[DEBUG] Using fallback body extraction`);
      mainContent = document.body;
      extractionMethod = 'body fallback';
      
      // Remove more navigation and fluff elements
      const navElements = document.querySelectorAll('a[href*="travel.state.gov"], a[href*="home"], a[href*="about"], a[href*="contact"], a[href*="careers"], .site-navigation, .main-navigation, .footer, .header');
      navElements.forEach(element => element.remove());
    }
    
    // Extract and clean text content
    let textContent = mainContent?.textContent || '';
    console.log(`[DEBUG] Raw extracted content length: ${textContent.length} using ${extractionMethod}`);
    
    textContent = textContent
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .replace(/Skip to main content/gi, '')  // Remove skip links
      .replace(/Travel\.State\.Gov/gi, '')  // Remove site branding
      .replace(/Home\|.*?\|/gi, '')  // Remove navigation breadcrumbs
      .replace(/Congressional Liaison.*?Contact Us/gi, '')  // Remove header navigation
      .replace(/Travel Advisories\s*\|\s*Newsroom/gi, '')  // Remove nav links
      .trim();
    
    console.log(`[DEBUG] Cleaned content length: ${textContent.length}`);
    
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

  console.log(`[DEBUG] Sending prompt to ChatGPT for ${countryName}:`, prompt.substring(0, 500) + '...');
  console.log(`[DEBUG] Truncated content length for ${countryName}:`, truncatedContent.length);

  try {
    // Use a working model with structured outputs for reliable results
    const response = await openai.chat.completions.create({
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
- summary: A detailed 2-3 paragraph summary that goes beyond just the threat level
- keyRisks: Array of 3-6 specific risks or threats mentioned  
- safetyRecommendations: Array of 3-6 specific safety recommendations
- specificAreas: Array of specific cities, regions, or areas mentioned`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    // Extract JSON content from chat completions response
    const rawContent = response.choices[0].message.content || '{}';
    console.log(`[DEBUG] ChatGPT response for ${countryName}:`, rawContent);
    
    const result = JSON.parse(rawContent);
    console.log(`[DEBUG] Parsed ChatGPT result for ${countryName}:`, JSON.stringify(result, null, 2));
    
    // Validate that essential fields are present - be flexible with arrays
    if (!result.summary || result.summary.length < 20) {
      console.warn(`[DEBUG] Invalid summary for ${countryName}: too short or missing`);
      result.summary = originalSummary; // Fallback to original
    }
    
    // Log validation warnings but don't throw errors for missing array data
    if (!Array.isArray(result.keyRisks) || result.keyRisks.length < 1) {
      console.warn(`[DEBUG] Limited keyRisks for ${countryName}: ${result.keyRisks?.length || 0} items`);
    }
    if (!Array.isArray(result.safetyRecommendations) || result.safetyRecommendations.length < 1) {
      console.warn(`[DEBUG] Limited safetyRecommendations for ${countryName}: ${result.safetyRecommendations?.length || 0} items`);
    }
    if (!Array.isArray(result.specificAreas) || result.specificAreas.length < 1) {
      console.warn(`[DEBUG] Limited specificAreas for ${countryName}: ${result.specificAreas?.length || 0} items`);
    }
    
    // Validate the response structure
    const processedResult = {
      summary: result.summary || originalSummary,
      keyRisks: Array.isArray(result.keyRisks) ? result.keyRisks : [],
      safetyRecommendations: Array.isArray(result.safetyRecommendations) ? result.safetyRecommendations : [],
      specificAreas: Array.isArray(result.specificAreas) ? result.specificAreas : [],
      aiApplied: true // AI analysis was successfully applied
    };
    
    console.log(`[DEBUG] Processed result for ${countryName}:`, JSON.stringify(processedResult, null, 2));
    return processedResult;

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