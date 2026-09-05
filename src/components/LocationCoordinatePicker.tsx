import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  Search,
  Check,
  Compass,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export interface LocationDetails {
  localizedName: string;
  originalName: string;
  localizedAddress: string;
  originalAddress: string;
}

export interface LocationCoordinatePickerProps {
  lat: number | string;
  lng: number | string;
  onChangeCoordinates: (lat: number | string, lng: number | string) => void;
  onAddressDetected?: (address: string) => void;
  onLocationDetailsDetected?: (details: LocationDetails) => void;
  className?: string;
  defaultExpanded?: boolean;
}

const PRESET_LOCATIONS = [
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
];

export const LocationCoordinatePicker: React.FC<LocationCoordinatePickerProps> = ({
  lat,
  lng,
  onChangeCoordinates,
  onAddressDetected,
  onLocationDetailsDetected,
  className = '',
  defaultExpanded = true,
}) => {
  const [isMapExpanded, setIsMapExpanded] = useState(defaultExpanded);
  const [isLocating, setIsLocating] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Reverse geocode coordinates to get localized English name + original native text
  const fetchLocationDetails = async (targetLat: number, targetLng: number) => {
    try {
      const res = await fetch(`/api/places/reverse-geocode?lat=${targetLat}&lng=${targetLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (onAddressDetected && data.localizedAddress) {
            onAddressDetected(data.localizedAddress);
          }
          if (onLocationDetailsDetected) {
            onLocationDetailsDetected({
              localizedName: data.localizedName || `Location (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`,
              originalName: data.originalName || data.localizedName || '',
              localizedAddress: data.localizedAddress || `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`,
              originalAddress: data.originalAddress || data.localizedAddress || '',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    }
  };

  // Parse current coordinates safely
  const parsedLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const parsedLng = typeof lng === 'number' ? lng : parseFloat(String(lng));
  const isValidCoord =
    !isNaN(parsedLat) &&
    !isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const currentLat = isValidCoord ? parsedLat : 37.7749;
  const currentLng = isValidCoord ? parsedLng : -122.4194;

  // Custom modern SVG Pin Icon with exact anchor alignment
  const createPinIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="position: relative; width: 34px; height: 43px; display: flex; flex-direction: column; align-items: center; cursor: grab; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
          <div style="background: linear-gradient(135deg, #4f46e5, #4338ca); color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div style="width: 3px; height: 6px; background-color: #4338ca; border-radius: 0 0 2px 2px;"></div>
          <div style="width: 10px; height: 3px; background-color: rgba(0,0,0,0.3); border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [34, 43],
      iconAnchor: [17, 43],
    });
  };

  // Initialize or re-render map when container is visible
  useEffect(() => {
    if (!isMapExpanded || !mapContainerRef.current) return;

    const container = mapContainerRef.current;

    // Destroy existing instance cleanly if already present on container
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (_) {}
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      const map = L.map(container, {
        center: [currentLat, currentLng],
        zoom: isValidCoord ? 14 : 3,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Create draggable pin marker
      const marker = L.marker([currentLat, currentLng], {
        icon: createPinIcon(),
        draggable: true,
      }).addTo(map);

      // Handle marker dragend
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const roundedLat = Math.round(position.lat * 1000000) / 1000000;
        const roundedLng = Math.round(position.lng * 1000000) / 1000000;
        onChangeCoordinates(roundedLat, roundedLng);
        fetchLocationDetails(roundedLat, roundedLng);
      });

      // Handle map click: relocate pin directly to clicked point
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: clickedLat, lng: clickedLng } = e.latlng;
        const roundedLat = Math.round(clickedLat * 1000000) / 1000000;
        const roundedLng = Math.round(clickedLng * 1000000) / 1000000;
        marker.setLatLng([roundedLat, roundedLng]);
        onChangeCoordinates(roundedLat, roundedLng);
        fetchLocationDetails(roundedLat, roundedLng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalidate size immediately and after layout rendering
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (_) {}
      }, 150);

      // ResizeObserver to handle modal layout transitions smoothly
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          try {
            map.invalidateSize();
          } catch (_) {}
        });
        resizeObserver.observe(container);
      }

      return () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (_) {}
          mapInstanceRef.current = null;
          markerRef.current = null;
        }
        if (container && (container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
        }
      };
    } catch (err) {
      console.warn('Leaflet coordinate picker map init notice:', err);
    }
  }, [isMapExpanded]);

  // Sync marker and map center when coordinates change from outside
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (isValidCoord) {
      const currentMarkerPos = markerRef.current.getLatLng();
      const diffLat = Math.abs(currentMarkerPos.lat - currentLat);
      const diffLng = Math.abs(currentMarkerPos.lng - currentLng);

      // Only update if difference is meaningful
      if (diffLat > 0.00001 || diffLng > 0.00001) {
        markerRef.current.setLatLng([currentLat, currentLng]);
        mapInstanceRef.current.panTo([currentLat, currentLng], { animate: true });
      }
    }
  }, [currentLat, currentLng, isValidCoord]);

  // Locate user's browser location safely without alert
  const handleLocateMe = () => {
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = Math.round(pos.coords.latitude * 1000000) / 1000000;
        const userLng = Math.round(pos.coords.longitude * 1000000) / 1000000;
        onChangeCoordinates(userLat, userLng);
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([userLat, userLng]);
          mapInstanceRef.current.setView([userLat, userLng], 15);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation lookup notice:', err);
        setGeoNotice('Could not access current location. Please verify browser location permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Jump to preset city
  const handleSelectPreset = (preset: { name: string; lat: number; lng: number }) => {
    setGeoNotice(null);
    onChangeCoordinates(preset.lat, preset.lng);
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([preset.lat, preset.lng]);
      mapInstanceRef.current.setView([preset.lat, preset.lng], 13);
    }
    if (onAddressDetected) {
      onAddressDetected(preset.name);
    }
    fetchLocationDetails(preset.lat, preset.lng);
  };

  // Search location directly on the map
  const handleSearchOnMap = async (
    e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent
  ) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      if ('stopPropagation' in e) {
        e.stopPropagation();
      }
    }
    const query = mapSearchQuery.trim();
    if (!query) return;

    setIsSearchingMap(true);
    setSearchError(null);

    try {
      // 1. Try server-side English-localized search
      const serverRes = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && serverData.results && serverData.results.length > 0) {
          const topResult = serverData.results[0];
          const roundedLat = Math.round(topResult.lat * 1000000) / 1000000;
          const roundedLng = Math.round(topResult.lng * 1000000) / 1000000;

          onChangeCoordinates(roundedLat, roundedLng);

          if (mapInstanceRef.current && markerRef.current) {
            markerRef.current.setLatLng([roundedLat, roundedLng]);
            mapInstanceRef.current.setView([roundedLat, roundedLng], 14);
          }

          if (onAddressDetected) {
            onAddressDetected(topResult.localizedAddress || topResult.address);
          }

          if (onLocationDetailsDetected) {
            onLocationDetailsDetected({
              localizedName: topResult.localizedName || topResult.name,
              originalName: topResult.originalName || topResult.name,
              localizedAddress: topResult.localizedAddress || topResult.address,
              originalAddress: topResult.originalAddress || topResult.address,
            });
          }

          setMapSearchQuery('');
          setIsSearchingMap(false);
          return;
        }
      }

      // 2. Direct Photon fallback with &lang=en
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`);
      if (res.ok) {
        const data = await res.json();
        if (data?.features && data.features.length > 0) {
          const feature = data.features[0];
          const newLng = feature.geometry.coordinates[0];
          const newLat = feature.geometry.coordinates[1];
          const roundedLat = Math.round(newLat * 1000000) / 1000000;
          const roundedLng = Math.round(newLng * 1000000) / 1000000;

          onChangeCoordinates(roundedLat, roundedLng);

          if (mapInstanceRef.current && markerRef.current) {
            markerRef.current.setLatLng([roundedLat, roundedLng]);
            mapInstanceRef.current.setView([roundedLat, roundedLng], 14);
          }

          const p = feature.properties || {};
          const street = [p.housenumber, p.street].filter(Boolean).join(' ');
          const fullAddress = [p.name, street, p.city, p.state, p.country].filter(Boolean).join(', ');
          if (fullAddress && onAddressDetected) {
            onAddressDetected(fullAddress);
          }
          if (onLocationDetailsDetected) {
            onLocationDetailsDetected({
              localizedName: p.name || query,
              originalName: p.extra?.['name'] || query,
              localizedAddress: fullAddress || `${roundedLat}, ${roundedLng}`,
              originalAddress: fullAddress || `${roundedLat}, ${roundedLng}`,
            });
          }

          setMapSearchQuery('');
          setIsSearchingMap(false);
          return;
        }
      }
      setSearchError(`No coordinates found for "${query}". Try another location.`);
    } catch (err) {
      console.warn('Map search error:', err);
      setSearchError('Search request could not be completed.');
    } finally {
      setIsSearchingMap(false);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header bar with trigger to expand/collapse Map Pinning */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-800">
            Geographical Coordinates <span className="text-red-500">*</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => setIsMapExpanded(!isMapExpanded)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
            isMapExpanded
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Click to toggle interactive Pin on Map"
        >
          <MapPin className="h-3.5 w-3.5 text-indigo-600" />
          <span>{isMapExpanded ? 'Hide Map Pin' : 'Pin Location on Map'}</span>
          {isMapExpanded ? (
            <ChevronUp className="h-3 w-3 text-indigo-600" />
          ) : (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          )}
        </button>
      </div>

      {/* Interactive Map Picker Container */}
      {isMapExpanded && (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/90 bg-slate-50 shadow-sm">
          {/* Map Top Bar: Quick search and actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSearchOnMap(e);
                  }
                }}
                placeholder="Search destination to drop pin..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              />
              {isSearchingMap ? (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-indigo-600" />
              ) : mapSearchQuery ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSearchOnMap(e);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Go
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocating}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
                title="Detect your current location and drop pin"
              >
                {isLocating ? (
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                ) : (
                  <Crosshair className="h-3 w-3 text-indigo-600" />
                )}
                <span>Locate Me</span>
              </button>
            </div>
          </div>

          {searchError && (
            <div className="border-b border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
              {searchError}
            </div>
          )}

          {geoNotice && (
            <div className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{geoNotice}</span>
            </div>
          )}

          {/* Leaflet Canvas Container */}
          <div className="relative">
            <div
              ref={mapContainerRef}
              style={{ height: '210px', width: '100%', zIndex: 10 }}
              className="w-full bg-slate-100 cursor-crosshair"
            />

            {/* Instruction Floating Pill */}
            <div className="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium text-white shadow-md backdrop-blur-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Click map or drag pin to adjust</span>
            </div>

            {/* Live Coordinates Readout Overlay */}
            <div className="pointer-events-none absolute top-2 right-2 z-20 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-700 shadow-xs border border-slate-200/80 backdrop-blur-xs">
              {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
            </div>
          </div>

          {/* Quick presets row */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600 shrink-0">Quick Jump:</span>
            {PRESET_LOCATIONS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-colors shrink-0"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Latitude & Longitude Inputs (Synchronized with Pin) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600">
            Latitude (-90 to 90)
          </label>
          <input
            type="text"
            required
            value={lat}
            onChange={(e) => onChangeCoordinates(e.target.value, lng)}
            placeholder="37.7749"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600">
            Longitude (-180 to 180)
          </label>
          <input
            type="text"
            required
            value={lng}
            onChange={(e) => onChangeCoordinates(lat, e.target.value)}
            placeholder="-122.4194"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>
    </div>
  );
};
