import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, ExternalLink, Globe } from "lucide-react";
import { type CountryData } from "@shared/schema";
import { useState } from "react";

interface CountryCardProps {
  countryData: CountryData;
}

export function CountryCard({ countryData }: CountryCardProps) {
  const { country, alerts, background } = countryData;
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
    switch (severity) {
      case "high":
        return "bg-red-50 border-red-200 text-red-800";
      case "medium":
        return "bg-orange-50 border-orange-200 text-orange-800";
      case "low":
        return "bg-green-50 border-green-200 text-green-800";
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-orange-100 text-orange-800";
      case "low":
        return "bg-green-100 text-green-800";
      case "info":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
          <h3 className="text-xl font-semibold text-foreground" data-testid={`text-country-name-${country.id}`}>
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
                  <h5 className="font-medium mb-1" data-testid={`text-alert-title-${country.id}-${index}`}>
                    {alert.title}
                  </h5>
                  <p className="text-sm mb-2" data-testid={`text-alert-summary-${country.id}-${index}`}>
                    {alert.summary}
                  </p>
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
      </CardContent>
    </Card>
  );
}
