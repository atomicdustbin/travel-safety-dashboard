import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchSectionProps {
  onSearch: (countries: string[]) => void;
  isLoading: boolean;
}

export function SearchSection({ onSearch, isLoading }: SearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    const countries = searchQuery
      .split(",")
      .map(country => country.trim())
      .filter(country => country.length > 0);
    
    if (countries.length > 0) {
      onSearch(countries);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Search Travel Advisories
            </h2>
            <p className="text-muted-foreground">
              Enter one or more countries (comma-separated) to view current travel alerts and background information
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              type="text"
              placeholder="e.g., Thailand, Japan, United Kingdom"
              className="w-full pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              data-testid="input-country-search"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary hover:text-primary/80 transition-colors bg-transparent border-none shadow-none hover:bg-transparent"
              data-testid="button-search"
            >
              <span className="text-sm font-medium">Search</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
