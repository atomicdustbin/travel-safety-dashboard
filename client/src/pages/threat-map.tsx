import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Shield, AlertCircle, Ban, Globe } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import type { GeoJsonObject } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CountryData {
  country: {
    id: string;
    name: string;
    code: string;
    flagUrl?: string;
  };
  threatLevel: number | null;
  lastUpdated: string | null;
  alertCount: number;
}

interface ThreatMapData {
  countries: CountryData[];
}

const getThreatColor = (level: number | null): string => {
  if (level === null) return "#94a3b8";
  switch (level) {
    case 1:
      return "#22c55e";
    case 2:
      return "#eab308";
    case 3:
      return "#f97316";
    case 4:
      return "#ef4444";
    default:
      return "#94a3b8";
  }
};

const getThreatLabel = (level: number | null): string => {
  if (level === null) return "Unknown";
  switch (level) {
    case 1:
      return "Exercise Normal Precautions";
    case 2:
      return "Exercise Increased Caution";
    case 3:
      return "Reconsider Travel";
    case 4:
      return "Do Not Travel";
    default:
      return "Unknown";
  }
};

const getThreatIcon = (level: number | null) => {
  if (level === null) return <AlertCircle className="w-4 h-4 text-gray-500" />;
  switch (level) {
    case 1:
      return <Shield className="w-4 h-4 text-green-500" />;
    case 2:
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 3:
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 4:
      return <Ban className="w-4 h-4 text-red-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
};

export default function ThreatMap() {
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(true);

  const { data: threatData, isLoading: isLoadingThreat } = useQuery<ThreatMapData>({
    queryKey: ["/api/countries"],
  });

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json")
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        setLoadingGeo(false);
      })
      .catch((error) => {
        console.error("Failed to load GeoJSON:", error);
        setLoadingGeo(false);
      });
  }, []);

  if (isLoadingThreat || loadingGeo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading global threat map...</p>
        </div>
      </div>
    );
  }

  const threatMap = new Map<string, CountryData>();
  threatData?.countries.forEach((country) => {
    const normalizedName = country.country.name.toLowerCase();
    threatMap.set(normalizedName, country);
  });

  const getCountryStyle = (feature: any) => {
    const countryName = feature.properties.name?.toLowerCase();
    const countryData = threatMap.get(countryName);
    const threatLevel = countryData?.threatLevel ?? null;

    return {
      fillColor: getThreatColor(threatLevel),
      weight: 1,
      opacity: 1,
      color: "#ffffff",
      fillOpacity: 0.7,
    };
  };

  const onEachCountry = (feature: any, layer: L.Layer) => {
    const countryName = feature.properties.name;
    const normalizedName = countryName?.toLowerCase();
    const countryData = threatMap.get(normalizedName);
    const threatLevel = countryData?.threatLevel ?? null;

    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 2,
          fillOpacity: 0.9,
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 1,
          fillOpacity: 0.7,
        });
      },
    });

    if (countryData) {
      const popupContent = `
        <div class="p-2 min-w-[200px]" data-testid="map-popup-${countryData.country.id}">
          <div class="flex items-center gap-2 mb-2">
            ${countryData.country.flagUrl ? `<img src="${countryData.country.flagUrl}" alt="${countryName}" class="w-8 h-6 object-cover rounded" />` : ''}
            <h3 class="font-bold text-lg">${countryName}</h3>
          </div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium">Threat Level ${threatLevel || 'N/A'}:</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">${getThreatLabel(threatLevel)}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <p>${countryData.alertCount} active alerts</p>
            ${countryData.lastUpdated ? `<p>Updated: ${new Date(countryData.lastUpdated).toLocaleDateString()}</p>` : ''}
          </div>
        </div>
      `;
      (layer as any).bindPopup(popupContent);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="page-threat-map">
      <header className="bg-card border-b border-border shadow-sm relative z-[1001]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Globe className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Global Threat Map</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden md:block">
                Real-time US State Dept advisories
              </span>
              <Navigation />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="h-full w-full"
          minZoom={2}
          maxZoom={6}
          data-testid="map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
              data={geoData}
              style={getCountryStyle}
              onEachFeature={onEachCountry}
            />
          )}
        </MapContainer>

        <div className="absolute top-4 right-4 bg-card border shadow-lg rounded-lg p-4 max-w-xs z-[1000]" data-testid="map-legend">
          <h3 className="font-bold text-sm mb-3">Threat Levels</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ backgroundColor: getThreatColor(1) }}></div>
              <Shield className="w-4 h-4 text-green-500" />
              <span>Level 1 - Normal Precautions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ backgroundColor: getThreatColor(2) }}></div>
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span>Level 2 - Increased Caution</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ backgroundColor: getThreatColor(3) }}></div>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span>Level 3 - Reconsider Travel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded" style={{ backgroundColor: getThreatColor(4) }}></div>
              <Ban className="w-4 h-4 text-red-500" />
              <span>Level 4 - Do Not Travel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 rounded bg-gray-400"></div>
              <AlertCircle className="w-4 h-4 text-gray-500" />
              <span>No Data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
