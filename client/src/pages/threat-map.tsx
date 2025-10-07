import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Shield, AlertCircle, Ban, Globe, Building2, Download } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

interface Embassy {
  id: string;
  countryCode: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  streetAddress?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
}

interface EmbassyResponse {
  embassies: Embassy[];
  count: number;
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

// Create custom embassy icon
const createEmbassyIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #1e40af;
        border: 2px solid white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
          <path d="M10 6h4"></path>
          <path d="M10 10h4"></path>
          <path d="M10 14h4"></path>
          <path d="M10 18h4"></path>
        </svg>
      </div>
    `,
    className: 'embassy-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

export default function ThreatMap() {
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const { toast } = useToast();

  const { data: threatData, isLoading: isLoadingThreat } = useQuery<ThreatMapData>({
    queryKey: ["/api/countries"],
  });

  const { data: embassyData } = useQuery<EmbassyResponse>({
    queryKey: ["/api/embassies"],
  });

  const embassyRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/embassies/refresh');
      return await response.json() as { message: string; count: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/embassies"] });
      toast({
        title: "Embassy data updated",
        description: `Successfully downloaded ${data.count} US embassies worldwide`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download embassy data",
        variant: "destructive",
      });
    },
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
          {embassyData?.embassies.map((embassy) => {
            // Get country name from code
            const countryData = Array.from(threatMap.values()).find(
              (c) => c.country.code === embassy.countryCode
            );
            const countryName = countryData?.country.name || embassy.countryCode;
            
            return (
              <Marker
                key={embassy.id}
                position={[embassy.latitude, embassy.longitude]}
                icon={createEmbassyIcon()}
              >
                <Popup>
                  <div className="p-2 min-w-[220px]" data-testid={`embassy-popup-${embassy.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-base">{embassy.name}</h3>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Type:</span> {embassy.type}
                      </p>
                      {(embassy.streetAddress || embassy.city) && (
                        <div className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Address:</span>
                          <div className="ml-0 mt-1">
                            {embassy.streetAddress && <div>{embassy.streetAddress}</div>}
                            {embassy.city && <div>{embassy.city}</div>}
                            <div className="capitalize">{countryName}</div>
                          </div>
                        </div>
                      )}
                      {embassy.phone && (
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Phone:</span>{" "}
                          <a href={`tel:${embassy.phone}`} className="text-blue-600 hover:underline">
                            {embassy.phone}
                          </a>
                        </p>
                      )}
                      {embassy.website && (
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Website:</span>{" "}
                          <a 
                            href={embassy.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Visit
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
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

        <div className="absolute bottom-4 left-4 z-[1000]" data-testid="embassy-sync-controls">
          <Button
            onClick={() => embassyRefreshMutation.mutate()}
            disabled={embassyRefreshMutation.isPending}
            size="sm"
            variant="secondary"
            className="shadow-lg"
            data-testid="button-refresh-embassies"
          >
            {embassyRefreshMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 mr-2" />
                Sync Embassies ({embassyData?.count || 0})
              </>
            )}
          </Button>
        </div>

        <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm border shadow-sm rounded px-3 py-2 z-[1000]" data-testid="contact-info">
          <p className="text-xs text-muted-foreground">
            For more information contact Matt Covington -{" "}
            <a href="mailto:mattcov@gmail.com" className="text-primary hover:underline">
              mattcov@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
