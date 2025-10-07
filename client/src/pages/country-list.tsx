import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { BulkRefreshButton } from "@/components/BulkRefreshButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, ArrowUp, ArrowDown, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CountryListItem {
  country: {
    id: string;
    name: string;
    code: string;
    flagUrl: string | null;
    lastUpdated: Date | null;
  };
  threatLevel: number | null; // 1-4 or null
  lastUpdated: Date | null;
  alertCount: number;
}

interface Alert {
  id: string;
  source: string;
  title: string;
  level: string | null;
  severity: string;
  summary: string;
  link: string;
  date: Date;
  keyRisks?: string[];
  safetyRecommendations?: string[];
  specificAreas?: string[];
  aiEnhanced?: Date | null;
}

interface CountryData {
  country: {
    id: string;
    name: string;
    code: string;
    flagUrl: string | null;
  };
  alerts: Alert[];
  backgroundInfo: any;
}

type SortField = "name" | "threat" | "lastUpdated";
type SortDirection = "asc" | "desc";

export default function CountryList() {
  const [sortField, setSortField] = useState<SortField>("threat");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/countries"],
  });

  const { data: countryDetailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["/api/country", selectedCountry],
    enabled: !!selectedCountry,
  });

  const countries = ((data as any)?.countries as CountryListItem[]) || [];
  const countryDetail = countryDetailData as CountryData | undefined;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "threat" ? "desc" : "asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 inline ml-1" />
    );
  };

  const sortedCountries = [...countries].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.country.name.localeCompare(b.country.name);
        break;
      case "threat":
        const levelA = a.threatLevel || 0;
        const levelB = b.threatLevel || 0;
        comparison = levelA - levelB;
        break;
      case "lastUpdated":
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const getThreatLevelColor = (level: number | null) => {
    switch (level) {
      case 1:
        return "bg-green-600 text-white";
      case 2:
        return "bg-yellow-500 text-white";
      case 3:
        return "bg-orange-500 text-white";
      case 4:
        return "bg-red-600 text-white";
      default:
        return "bg-gray-500 text-white";
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
        return "No Advisory";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRowClick = (countryName: string) => {
    setSelectedCountry(countryName);
  };

  const getAIEnhancedAlert = () => {
    if (!countryDetail?.alerts) return null;
    return countryDetail.alerts.find(alert => 
      alert.aiEnhanced && (alert.keyRisks || alert.safetyRecommendations || alert.specificAreas)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Globe className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Cached Countries</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground" data-testid="text-country-count">
                {countries.length} {countries.length === 1 ? "country" : "countries"}
              </span>
              <Navigation />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="loading-state">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading countries...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center" data-testid="error-state">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Failed to Load Countries</h3>
            <p className="text-destructive/80">Please try again later.</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && countries.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center" data-testid="empty-state">
            <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Countries Found</h3>
            <p className="text-muted-foreground mb-4">
              No travel advisory data has been downloaded yet.
            </p>
            <Link href="/">
              <Button data-testid="button-start-search">
                Start Searching
              </Button>
            </Link>
          </div>
        )}

        {/* Countries Table */}
        {!isLoading && !error && countries.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center font-semibold hover:text-primary transition-colors"
                      data-testid="sort-name"
                    >
                      Country Name
                      {getSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("threat")}
                      className="flex items-center font-semibold hover:text-primary transition-colors"
                      data-testid="sort-threat"
                    >
                      Threat Level
                      {getSortIcon("threat")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("lastUpdated")}
                      className="flex items-center font-semibold hover:text-primary transition-colors"
                      data-testid="sort-lastUpdated"
                    >
                      Last Refreshed
                      {getSortIcon("lastUpdated")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCountries.map((item) => (
                  <TableRow
                    key={item.country.id}
                    data-testid={`row-country-${item.country.id}`}
                    onClick={() => handleRowClick(item.country.name)}
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <TableCell>
                      {item.country.flagUrl && (
                        <img
                          src={item.country.flagUrl}
                          alt={`${item.country.name} flag`}
                          className="w-8 h-6 object-cover rounded"
                          data-testid={`img-flag-${item.country.id}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium capitalize" data-testid={`text-name-${item.country.id}`}>
                      {item.country.name}
                    </TableCell>
                    <TableCell data-testid={`text-threat-${item.country.id}`}>
                      <div className={`px-3 py-1.5 rounded text-sm font-semibold inline-block ${getThreatLevelColor(item.threatLevel)}`}>
                        {item.threatLevel ? `Level ${item.threatLevel}` : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      data-testid={`text-updated-${item.country.id}`}
                    >
                      {formatDate(item.lastUpdated)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bulk Refresh Section */}
        {!isLoading && !error && countries.length > 0 && (
          <div className="mt-8 text-center pb-8">
            <div className="text-xs text-muted-foreground mb-3">
              Download latest advisories for all countries
            </div>
            <BulkRefreshButton />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-muted border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-xs text-muted-foreground" data-testid="contact-info">
            For more information contact Matt Covington -{" "}
            <a href="mailto:mattcov@gmail.com" className="text-primary hover:underline">
              mattcov@gmail.com
            </a>
          </p>
        </div>
      </footer>

      {/* AI Summary Dialog */}
      <Dialog open={!!selectedCountry} onOpenChange={(open) => !open && setSelectedCountry(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-ai-summary">
          <DialogHeader>
            <DialogTitle className="text-2xl capitalize flex items-center gap-3">
              {selectedCountry && countryDetail?.country.flagUrl && (
                <img
                  src={countryDetail.country.flagUrl}
                  alt={`${selectedCountry} flag`}
                  className="w-10 h-7 object-cover rounded"
                />
              )}
              {selectedCountry}
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetail && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading AI-enhanced summary...</p>
            </div>
          )}

          {!isLoadingDetail && countryDetail && (() => {
            const aiAlert = getAIEnhancedAlert();
            
            if (!aiAlert) {
              return (
                <div className="py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No AI-enhanced summary available for this country.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-6" data-testid="ai-summary-content">
                {/* Key Risks */}
                {aiAlert.keyRisks && aiAlert.keyRisks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      Key Risks
                    </h3>
                    <ul className="space-y-2">
                      {aiAlert.keyRisks.map((risk, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-foreground"
                          data-testid={`key-risk-${index}`}
                        >
                          <span className="text-orange-500 mt-1">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Safety Recommendations */}
                {aiAlert.safetyRecommendations && aiAlert.safetyRecommendations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-500" />
                      Safety Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {aiAlert.safetyRecommendations.map((rec, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-foreground"
                          data-testid={`safety-rec-${index}`}
                        >
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Specific Areas */}
                {aiAlert.specificAreas && aiAlert.specificAreas.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                      <Globe className="w-5 h-5 text-purple-500" />
                      Specific Areas of Concern
                    </h3>
                    <ul className="space-y-2">
                      {aiAlert.specificAreas.map((area, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-foreground"
                          data-testid={`specific-area-${index}`}
                        >
                          <span className="text-purple-500 mt-1">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Enhancement Date */}
                {aiAlert.aiEnhanced && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      AI-enhanced on {formatDate(aiAlert.aiEnhanced)}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
