import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchSection } from "@/components/SearchSection";
import { CountryCard } from "@/components/CountryCard";
import { LoadingState } from "@/components/LoadingState";
import { AuthModal } from "@/components/AuthModal";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { RefreshCw, Globe, AlertCircle, Search, LogIn } from "lucide-react";
import { type SearchResult } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const [searchCountries, setSearchCountries] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // Check for reset token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset-token');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/search?countries=${encodeURIComponent(searchCountries.join(","))}`],
    enabled: searchCountries.length > 0,
  });

  const searchResults = ((data as any)?.results as SearchResult) || [];

  // Function to extract US State Department threat level from country data
  const getStateDeptThreatLevel = (countryData: any) => {
    const stateDeptAlert = countryData.alerts?.find((alert: any) => alert.source === "US State Dept");
    if (!stateDeptAlert || !stateDeptAlert.level) return 0; // Default to 0 for countries without a level
    
    // Extract number from level (e.g., "Level 1" -> 1)
    const levelMatch = stateDeptAlert.level.match(/Level (\d)/);
    return levelMatch ? parseInt(levelMatch[1]) : 0;
  };

  // Sort results by threat level (highest level first)
  const sortedResults = [...searchResults].sort((a, b) => {
    const levelA = getStateDeptThreatLevel(a);
    const levelB = getStateDeptThreatLevel(b);
    return levelB - levelA; // Sort descending (Level 4 first, then 3, 2, 1)
  });

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

  // Show authentication loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show reset password form if reset token is present
  if (resetToken) {
    return <ResetPasswordForm token={resetToken} />;
  }

  // Show authentication modal if user is not logged in
  if (!isAuthenticated) {
    return <AuthModal />;
  }

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
              <UserMenu user={user} />
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
            {/* Check if this is a country validation error (400 status) */}
            {(error as any)?.response?.status === 400 ? (
              <>
                <h3 className="text-lg font-semibold text-destructive mb-2">Country Not Found</h3>
                <p className="text-destructive/80 mb-4" data-testid="text-error-message">
                  Please check the spelling and try again.
                </p>
                {/* Show specific error details if available */}
                {(error as any)?.response?.data?.details && (
                  <div className="bg-destructive/5 border border-destructive/10 rounded-md p-3 mb-4 text-sm">
                    <ul className="text-destructive/90 space-y-1">
                      {(error as any).response.data.details.map((detail: string, index: number) => (
                        <li key={index}>• {detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  onClick={handleRefresh}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-retry"
                >
                  Try Again
                </Button>
              </>
            ) : (
              /* Default error for API/network issues */
              <>
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
              </>
            )}
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && searchResults.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-results-title">
                Travel Information for {searchResults.length} {searchResults.length === 1 ? 'Country' : 'Countries'}
              </h2>
              <div className="text-sm text-muted-foreground" data-testid="text-results-count">
                {searchResults.length} result{searchResults.length === 1 ? '' : 's'} found
              </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {sortedResults.map((countryData) => (
                <CountryCard
                  key={countryData.country.id}
                  countryData={countryData}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && hasSearched && searchResults.length === 0 && (
          <div className="text-center py-12" data-testid="empty-state">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Results Found</h3>
            <p className="text-muted-foreground">
              No travel information found for the requested countries.
            </p>
          </div>
        )}

        {/* Welcome State */}
        {!isLoading && !error && !hasSearched && (
          <div className="text-center py-16" data-testid="welcome-state">
            <Globe className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Welcome to Global Travel Advisory
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Get real-time travel alerts and comprehensive country information from trusted government sources including the US State Department, UK FCDO, and CDC.
            </p>
            <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span>Travel Advisories</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-500" />
                <span>Country Information</span>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-green-500" />
                <span>Real-time Updates</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}