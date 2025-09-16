import puppeteer from 'puppeteer';
import { type SearchResult } from '@shared/schema';

// HTML escape function to prevent HTML injection attacks
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe || '');
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function generatePDFReport(searchResults: SearchResult, searchQuery: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
  });

  try {
    const page = await browser.newPage();
    
    const html = generateHTMLTemplate(searchResults, searchQuery);
    
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-top: 5mm;">
          <span>Global Advisor - Travel Safety Report</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-bottom: 5mm;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString()}</span>
        </div>
      `
    });
    
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function generateHTMLTemplate(searchResults: SearchResult, searchQuery: string): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const getThreatLevelColor = (level: number | null) => {
    switch (level) {
      case 1: return '#16a34a'; // Green
      case 2: return '#eab308'; // Yellow
      case 3: return '#f97316'; // Orange
      case 4: return '#dc2626'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const getThreatLevelText = (level: number | null) => {
    switch (level) {
      case 1: return 'Level 1: Exercise Normal Precautions';
      case 2: return 'Level 2: Exercise Increased Caution';
      case 3: return 'Level 3: Reconsider Travel';
      case 4: return 'Level 4: Do Not Travel';
      default: return 'Travel Advisory Level Not Available';
    }
  };

  const getStateDeptThreatLevel = (alerts: any[]) => {
    const stateDeptAlert = alerts.find(alert => alert.source === "US State Dept");
    if (!stateDeptAlert || !stateDeptAlert.level) return null;
    
    const levelMatch = stateDeptAlert.level.match(/Level (\d)/);
    return levelMatch ? parseInt(levelMatch[1]) : null;
  };

  // Removed getSeverityBadgeColor function - using clean styling without background colors

  const countriesHTML = searchResults.map(countryData => {
    const { country, alerts, background } = countryData;
    const threatLevel = getStateDeptThreatLevel(alerts);
    const threatColor = getThreatLevelColor(threatLevel);

    return `
      <div class="country-section">
        <div class="threat-indicator" style="background-color: ${threatColor};">
          <div class="threat-text">${getThreatLevelText(threatLevel)}</div>
        </div>
        
        <div class="country-header">
          <h2 class="country-name">${escapeHtml(country.name.charAt(0).toUpperCase() + country.name.slice(1))}</h2>
          <div class="country-code">${escapeHtml(country.code)}</div>
        </div>

        <div class="section">
          <h3 class="section-title">🚨 Current Alerts</h3>
          ${alerts.length > 0 ? `
            <div class="alerts-container">
              ${alerts.map(alert => `
                <div class="alert-item">
                  <div class="alert-header">
                    <span class="source-badge">
                      ${escapeHtml(alert.source)}
                    </span>
                    <span class="alert-date">${new Date(alert.date).toLocaleDateString()}</span>
                    ${alert.level ? `
                      <span class="level-badge">
                        ${escapeHtml(alert.level)}
                      </span>
                    ` : ''}
                  </div>
                  <h4 class="alert-title">${escapeHtml(alert.title)}</h4>
                  <p class="alert-summary">${escapeHtml(alert.summary)}</p>
                  
                  ${alert.source === "US State Dept" && alert.aiEnhanced && ((alert.keyRisks && alert.keyRisks.length > 0) || (alert.safetyRecommendations && alert.safetyRecommendations.length > 0) || (alert.specificAreas && alert.specificAreas.length > 0)) ? `
                    <div class="ai-enhanced-section">
                      <div class="ai-enhanced-header">
                        <span class="ai-badge">🧠 AI Enhanced Analysis</span>
                      </div>
                      
                      ${alert.keyRisks && alert.keyRisks.length > 0 ? `
                        <div class="ai-subsection">
                          <h5 class="ai-subsection-title">⚠️ Key Risks</h5>
                          <ul class="ai-list">
                            ${alert.keyRisks.map(risk => `<li>${escapeHtml(risk)}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                      
                      ${alert.safetyRecommendations && alert.safetyRecommendations.length > 0 ? `
                        <div class="ai-subsection">
                          <h5 class="ai-subsection-title">🛡️ Safety Recommendations</h5>
                          <ul class="ai-list">
                            ${alert.safetyRecommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                      
                      ${alert.specificAreas && alert.specificAreas.length > 0 ? `
                        <div class="ai-subsection">
                          <h5 class="ai-subsection-title">📍 Specific Areas</h5>
                          <ul class="ai-list">
                            ${alert.specificAreas.map(area => `<li>${escapeHtml(area)}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                  
                  <div class="alert-link">
                    <strong>Full Advisory:</strong> <a href="${escapeHtml(alert.link)}">${escapeHtml(alert.link)}</a>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="no-data">No current alerts available</div>
          `}
        </div>

        <div class="section">
          <h3 class="section-title">📋 Background Information</h3>
          ${background ? `
            <div class="background-grid">
              <div class="background-item">
                <dt>Languages</dt>
                <dd>${escapeHtml(background.languages?.join(', ') || 'Unknown')}</dd>
              </div>
              <div class="background-item">
                <dt>Religion</dt>
                <dd>${escapeHtml(background.religion || 'Unknown')}</dd>
              </div>
              <div class="background-item">
                <dt>GDP per capita</dt>
                <dd>${background.gdpPerCapita ? `$${background.gdpPerCapita.toLocaleString()}` : 'Unknown'}</dd>
              </div>
              <div class="background-item">
                <dt>Population</dt>
                <dd>${escapeHtml(background.population || 'Unknown')}</dd>
              </div>
              <div class="background-item">
                <dt>Capital</dt>
                <dd>${escapeHtml(background.capital || 'Unknown')}</dd>
              </div>
              <div class="background-item">
                <dt>Currency</dt>
                <dd>${escapeHtml(background.currency || 'Unknown')}</dd>
              </div>
            </div>
            ${background.wikiLink ? `
              <div class="wiki-link">
                <strong>Travel Guide:</strong> <a href="${escapeHtml(background.wikiLink)}">${escapeHtml(background.wikiLink)}</a>
              </div>
            ` : ''}
          ` : `
            <div class="no-data">Background information not available</div>
          `}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Global Advisor - Travel Safety Report</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #2563eb;
        }
        
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        
        .report-title {
          font-size: 20px;
          color: #666;
          margin-bottom: 5px;
        }
        
        .report-meta {
          color: #888;
          font-size: 14px;
        }
        
        .search-summary {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border-left: 4px solid #2563eb;
        }
        
        .country-section {
          margin-bottom: 50px;
          page-break-inside: avoid;
        }
        
        .threat-indicator {
          padding: 15px;
          color: white;
          text-align: center;
          margin-bottom: 20px;
          border-radius: 8px 8px 0 0;
        }
        
        .threat-text {
          font-weight: bold;
          font-size: 14px;
        }
        
        .country-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 8px 8px;
          margin-bottom: 20px;
        }
        
        .country-name {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          text-transform: capitalize;
        }
        
        .country-code {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }
        
        .section {
          margin-bottom: 30px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .alerts-container {
          /* Spacing handled by margin-bottom on .alert-item */
        }
        
        .alert-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          background: white;
        }
        
        .alert-header {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        
        .source-badge, .level-badge {
          color: #374151;
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background: white;
        }
        
        .alert-date {
          color: #6b7280;
          font-size: 12px;
        }
        
        .alert-title {
          font-weight: bold;
          margin-bottom: 8px;
          color: #1f2937;
          font-size: 14px;
        }
        
        .alert-summary {
          color: #4b5563;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .alert-link {
          font-size: 12px;
          word-break: break-all;
        }
        
        .alert-link a {
          color: #2563eb;
          text-decoration: none;
        }
        
        .background-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .background-item dt {
          font-weight: 600;
          color: #6b7280;
          font-size: 14px;
        }
        
        .background-item dd {
          color: #1f2937;
          font-size: 14px;
          margin-top: 2px;
        }
        
        .wiki-link {
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          word-break: break-all;
        }
        
        .wiki-link a {
          color: #2563eb;
          text-decoration: none;
        }
        
        .no-data {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }
        
        /* AI Enhancement Section Styles */
        .ai-enhanced-section {
          background: white;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          margin: 10px 0;
        }
        
        .ai-enhanced-header {
          margin-bottom: 10px;
        }
        
        .ai-badge {
          background: white;
          color: #374151;
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .ai-subsection {
          margin-bottom: 10px;
        }
        
        .ai-subsection:last-child {
          margin-bottom: 0;
        }
        
        .ai-subsection-title {
          color: #1e40af;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .ai-list {
          margin: 0;
          padding-left: 15px;
          font-size: 12px;
          color: #374151;
          line-height: 1.4;
        }
        
        .ai-list li {
          margin-bottom: 3px;
        }
        
        .ai-list li:last-child {
          margin-bottom: 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🌍 Global Advisor</div>
        <div class="report-title">Travel Safety Report</div>
        <div class="report-meta">Generated on ${currentDate}</div>
      </div>
      
      <div class="search-summary">
        <h3>Search Results Summary</h3>
        <p><strong>Search Query:</strong> ${escapeHtml(searchQuery)}</p>
        <p><strong>Countries Found:</strong> ${searchResults.length}</p>
        <p><strong>Total Alerts:</strong> ${searchResults.reduce((total, country) => total + country.alerts.length, 0)}</p>
      </div>
      
      ${countriesHTML}
    </body>
    </html>
  `;
}