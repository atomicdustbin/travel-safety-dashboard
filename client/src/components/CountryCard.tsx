import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, ExternalLink, Globe, Brain, Shield, MapPin, Building2, Phone } from "lucide-react";
import { type CountryData } from "@shared/schema";
import { useState } from "react";

interface CountryCardProps {
  countryData: CountryData;
}

export function CountryCard({ countryData }: CountryCardProps) {
  const { country, alerts, background, embassies } = countryData;
  const [flagError, setFlagError] = useState(false);

  // Find US State Department alert and extract threat level
  const getStateDeptThreatLevel = () => {
    const stateDeptAlert = alerts.find(alert => alert.source === "US State Dept");
    if (!stateDeptAlert || !stateDeptAlert.level) return null;
    
    // Extract number from level (e.g., "Level 1" -> 1)
    const levelMatch = stateDeptAlert.level.match(/Level (\d)/);
    return levelMatch ? parseInt(levelMatch[1]) : null;
  };

  const getThreatLevelColor = (level: number | null) => {
    switch (level) {
      case 1:
        return "bg-green-600"; // Green for Level 1
      case 2:
        return "bg-yellow-500"; // Yellow for Level 2
      case 3:
        return "bg-orange-500"; // Orange for Level 3
      case 4:
        return "bg-red-600"; // Red for Level 4
      default:
        return "bg-gray-500"; // Gray if no level found
    }
  };

  const getThreatLevelText = (level: number | null) => {
    switch (level) {
      case 1:
        return "Level 1: Exercise Normal Precautions";
      case 2:
        return "Level 2: Exercise Increased Caution";
      case 3:
        return "Level 3: Reconsider Travel";
      case 4:
        return "Level 4: Do Not Travel";
      default:
        return "Travel Advisory Level Not Available";
    }
  };

  const threatLevel = getStateDeptThreatLevel();

  const getSeverityClass = (severity: string) => {
    // Simplified styling without background colors for cleaner look
    return "border border-gray-200 text-foreground";
  };

  const getSeverityBadgeClass = (severity: string) => {
    // Simplified badge styling without background colors for cleaner look
    return "border border-gray-300 text-foreground bg-background";
  };

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`card-country-${country.id}`}>
      {/* US State Department Threat Level Indicator */}
      <div 
        className={`${getThreatLevelColor(threatLevel)} px-4 py-3 text-center`}
        data-testid={`threat-level-${country.id}`}
      >
        <div className="text-white font-semibold text-sm">
          {getThreatLevelText(threatLevel)}
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground capitalize" data-testid={`text-country-name-${country.id}`}>
            {country.name}
          </h3>
          <div className="flex items-center space-x-2">
            {country.flagUrl && !flagError ? (
              <img
                src={country.flagUrl}
                alt={`${country.name} flag`}
                className="w-8 h-6 rounded border"
                data-testid={`img-flag-${country.id}`}
                onError={() => setFlagError(true)}
                onLoad={() => setFlagError(false)}
              />
            ) : (
              <div className="w-8 h-6 rounded border bg-muted flex items-center justify-center">
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm text-muted-foreground" data-testid={`text-country-code-${country.id}`}>
              {country.code}
            </span>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-foreground mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-primary" />
            Current Alerts
          </h4>

          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-3 ${getSeverityClass(alert.severity)}`}
                  data-testid={`alert-${country.id}-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge
                        className={getSeverityBadgeClass(alert.severity)}
                        data-testid={`badge-source-${country.id}-${index}`}
                      >
                        {alert.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground" data-testid={`text-date-${country.id}-${index}`}>
                        {new Date(alert.date).toLocaleDateString()}
                      </span>
                    </div>
                    {alert.level && (
                      <Badge
                        className={getSeverityBadgeClass(alert.severity)}
                        data-testid={`badge-level-${country.id}-${index}`}
                      >
                        {alert.level}
                      </Badge>
                    )}
                  </div>
                  <h5 className="text-sm font-medium mb-1" data-testid={`text-alert-title-${country.id}-${index}`}>
                    {alert.title}
                  </h5>
                  <p className="text-sm mb-2" data-testid={`text-alert-summary-${country.id}-${index}`}>
                    {alert.summary}
                  </p>
                  
                  {/* AI-Enhanced Information for US State Dept */}
                  {alert.source === "US State Dept" && alert.aiEnhanced && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center mb-2">
                        <Brain className="w-4 h-4 mr-1 text-blue-600" />
                        <span className="text-xs font-medium text-foreground border border-gray-300 px-2 py-1 rounded">
                          AI Enhanced Analysis
                        </span>
                      </div>
                      
                      {alert.keyRisks && alert.keyRisks.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center mb-1">
                            <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
                            <span className="text-sm font-semibold text-gray-700">Key Risks</span>
                          </div>
                          <ul className="text-sm text-gray-600 ml-4 space-y-0.5">
                            {alert.keyRisks.slice(0, 4).map((risk, riskIndex) => (
                              <li key={riskIndex} className="list-disc" data-testid={`text-risk-${country.id}-${index}-${riskIndex}`}>
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {alert.safetyRecommendations && alert.safetyRecommendations.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center mb-1">
                            <Shield className="w-3 h-3 mr-1 text-green-500" />
                            <span className="text-sm font-semibold text-gray-700">Safety Recommendations</span>
                          </div>
                          <ul className="text-sm text-gray-600 ml-4 space-y-0.5">
                            {alert.safetyRecommendations.slice(0, 4).map((rec, recIndex) => (
                              <li key={recIndex} className="list-disc" data-testid={`text-recommendation-${country.id}-${index}-${recIndex}`}>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {alert.specificAreas && alert.specificAreas.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center mb-1">
                            <MapPin className="w-3 h-3 mr-1 text-purple-500" />
                            <span className="text-sm font-semibold text-gray-700">Specific Areas</span>
                          </div>
                          <p className="text-sm text-gray-600 ml-4" data-testid={`text-areas-${country.id}-${index}`}>
                            {alert.specificAreas.slice(0, 5).join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <a
                    href={alert.link}
                    className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-alert-${country.id}-${index}`}
                  >
                    View full advisory
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground" data-testid={`text-no-alerts-${country.id}`}>
              No current alerts available
            </div>
          )}
        </div>

        {/* Background Information */}
        <div className="border-t border-border pt-4">
          <h4 className="text-lg font-medium text-foreground mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" />
            Background Info
          </h4>

          {background ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Languages</dt>
                  <dd className="text-foreground" data-testid={`text-languages-${country.id}`}>
                    {background.languages?.join(", ") || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Religion</dt>
                  <dd className="text-foreground" data-testid={`text-religion-${country.id}`}>
                    {background.religion || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">GDP per capita</dt>
                  <dd className="text-foreground" data-testid={`text-gdp-${country.id}`}>
                    {background.gdpPerCapita ? `$${background.gdpPerCapita.toLocaleString()}` : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Population</dt>
                  <dd className="text-foreground" data-testid={`text-population-${country.id}`}>
                    {background.population || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Capital</dt>
                  <dd className="text-foreground" data-testid={`text-capital-${country.id}`}>
                    {background.capital || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Currency</dt>
                  <dd className="text-foreground" data-testid={`text-currency-${country.id}`}>
                    {background.currency || "Unknown"}
                  </dd>
                </div>
              </div>

              {background.wikiLink && (
                <div className="mt-3 pt-3 border-t border-border">
                  <a
                    href={background.wikiLink}
                    className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-wiki-${country.id}`}
                  >
                    View travel guide on Wikivoyage
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground" data-testid={`text-no-background-${country.id}`}>
              Background information not available
            </div>
          )}
        </div>

        {/* US Embassy & Consulate Information */}
        {embassies && embassies.length > 0 && (
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="text-lg font-medium text-foreground mb-3 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-primary" />
              US Embassy & Consulates
            </h4>
            <div className="space-y-3">
              {embassies.map((embassy, index) => (
                <div
                  key={embassy.id}
                  className="border border-gray-200 rounded-lg p-3"
                  data-testid={`embassy-${country.id}-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="text-sm font-semibold text-foreground" data-testid={`text-embassy-name-${country.id}-${index}`}>
                      {embassy.name}
                    </h5>
                    <Badge className="border border-gray-300 text-foreground bg-background capitalize" data-testid={`badge-embassy-type-${country.id}-${index}`}>
                      {embassy.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  {embassy.streetAddress && embassy.city && (
                    <div className="flex items-start text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                      <span data-testid={`text-embassy-address-${country.id}-${index}`}>
                        {embassy.streetAddress}, {embassy.city}
                      </span>
                    </div>
                  )}
                  
                  {embassy.phone && (
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Phone className="w-4 h-4 mr-1" />
                      <a href={`tel:${embassy.phone}`} className="hover:text-primary" data-testid={`link-embassy-phone-${country.id}-${index}`}>
                        {embassy.phone}
                      </a>
                    </div>
                  )}
                  
                  {embassy.website && (
                    <a
                      href={embassy.website}
                      className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-embassy-website-${country.id}-${index}`}
                    >
                      Visit website
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
