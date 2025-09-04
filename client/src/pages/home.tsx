import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchSection } from "@/components/SearchSection";
import { CountryCard } from "@/components/CountryCard";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { RefreshCw, Globe, AlertCircle, Search } from "lucide-react";
import { type SearchResult } from "@shared/schema";

export default function Home() {
  const [searchCountries, setSearchCountries] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/search", { countries: searchCountries.join(",") }],
    enabled: searchCountries.length > 0,
  });

  const searchResults = data?.results as SearchResult || [];

  const handleSearch = (countries: string[]) => {
    setSearchCountries(countries);
    setHasSearched(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  const currentTime = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Global Travel Advisory</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:block" data-testid="text-last-updated">
                Last updated: {currentTime}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-5 h-5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <SearchSection onSearch={handleSearch} isLoading={isLoading} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {isLoading && <LoadingState count={searchCountries.length} />}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center" data-testid="error-state">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Unable to Load Data</h3>
            <p className="text-destructive/80 mb-4" data-testid="text-error-message">
              Some data sources are currently unavailable. Please try again later.
            </p>
            <Button
              onClick={handleRefresh}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-retry"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && searchResults.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="search-results">
            {searchResults.map((countryData) => (
              <CountryCard key={countryData.country.id} countryData={countryData} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && hasSearched && searchResults.length === 0 && (
          <div className="text-center py-12" data-testid="no-results-state">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Results Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No travel information found for the requested countries. Please check the spelling and try again.
            </p>
          </div>
        )}

        {/* Default Empty State */}
        {!hasSearched && !isLoading && (
          <div className="text-center py-12" data-testid="empty-state">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Search for Countries</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Enter one or more country names above to view current travel advisories, alerts, and background information.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-muted border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Data Sources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• US State Department Travel Advisories</li>
                <li>• UK FCDO Foreign Travel Advice</li>
                <li>• CDC Travel Health Notices</li>
                <li>• USGS Earthquake Data</li>
                <li>• ReliefWeb Crisis Updates</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">Background Information</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• CIA World Factbook</li>
                <li>• World Bank Country Indicators</li>
                <li>• Wikivoyage Travel Guides</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">Update Frequency</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Alert data: Every 6 hours</li>
                <li>• Background data: Weekly</li>
                <li>• Earthquake data: Real-time</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
            <p>This tool aggregates publicly available travel and safety information. Always consult official government sources for the most current travel guidance.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
