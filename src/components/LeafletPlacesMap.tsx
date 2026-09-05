import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Compass,
  Navigation,
  ExternalLink,
  Edit2,
  Trash2,
  Star,
  CheckCircle2,
  Clock,
  Heart,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { PlaceOfInterest, PlaceVisitStatus } from '../types';

interface LeafletPlacesMapProps {
  places: PlaceOfInterest[];
  selectedPlace: PlaceOfInterest | null;
  onSelectPlace: (place: PlaceOfInterest | null) => void;
  onOpenEditPlace?: (place: PlaceOfInterest) => void;
  onDeletePlace?: (placeId: string) => void;
  onUpdateStatus?: (placeId: string, status: PlaceVisitStatus) => void;
}

export const LeafletPlacesMap: React.FC<LeafletPlacesMapProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
  onOpenEditPlace,
  onDeletePlace,
  onUpdateStatus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  const [activePopupPlace, setActivePopupPlace] = useState<PlaceOfInterest | null>(
    selectedPlace
  );

  // Helper to generate marker icon based on place status
  const getMarkerIcon = (place: PlaceOfInterest, isSelected: boolean) => {
    let pinColor = '#4f46e5'; // indigo
    let pinDark = '#3730a3';
    let iconSvg = `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`;

    if (place.status === 'visited') {
      pinColor = '#059669'; // emerald
      pinDark = '#047857';
      iconSvg = `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`;
    } else if (place.status === 'favorite') {
      pinColor = '#d97706'; // amber
      pinDark = '#b45309';
      iconSvg = `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`;
    }

    const scale = isSelected ? 1.2 : 1.0;
    const border = isSelected ? '3px solid #ffffff' : '2px solid #ffffff';
    const shadow = isSelected
      ? '0 6px 16px rgba(79, 70, 229, 0.5)'
      : '0 3px 8px rgba(0, 0, 0, 0.25)';

    return L.divIcon({
      className: 'leaflet-custom-pin',
      html: `
        <div style="position: relative; width: 34px; height: 43px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: scale(${scale}); transform-origin: bottom center; transition: transform 0.2s ease;">
          <div style="background: ${pinColor}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: ${border}; box-shadow: ${shadow};">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${iconSvg}
            </svg>
          </div>
          <div style="width: 3px; height: 6px; background-color: ${pinDark}; border-radius: 0 0 2px 2px;"></div>
          <div style="width: 10px; height: 3px; background-color: rgba(0,0,0,0.3); border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [34, 43],
      iconAnchor: [17, 43],
    });
  };

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (_) {}
      mapInstanceRef.current = null;
      markersRef.current = {};
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const initialCenter: [number, number] =
      places.length > 0 && typeof places[0].lat === 'number' && !isNaN(places[0].lat)
        ? [places[0].lat, places[0].lng]
        : [37.7749, -122.4194];

    try {
      const map = L.map(container, {
        center: initialCenter,
        zoom: places.length > 0 ? 12 : 4,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (_) {}
      }, 200);

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
          markersRef.current = {};
        }
        if (container && (container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
        }
      };
    } catch (err) {
      console.warn('Leaflet places map init notice:', err);
    }
  }, []);

  // Update Markers whenever places or selectedPlace change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    (Object.values(markersRef.current) as L.Marker[]).forEach((m) => {
      try {
        m.remove();
      } catch (_) {}
    });
    markersRef.current = {};

    const bounds: [number, number][] = [];

    places.forEach((place) => {
      if (
        typeof place.lat !== 'number' ||
        typeof place.lng !== 'number' ||
        isNaN(place.lat) ||
        isNaN(place.lng)
      ) {
        return;
      }

      const isSelected = selectedPlace?.id === place.id;
      const displayName = place.localizedName || place.name;
      const marker = L.marker([place.lat, place.lng], {
        icon: getMarkerIcon(place, isSelected),
        zIndexOffset: isSelected ? 1000 : 10,
        title: displayName,
      }).addTo(map);

      marker.bindTooltip(displayName, {
        direction: 'top',
        offset: [0, -38],
        opacity: 0.9,
      });

      marker.on('click', () => {
        onSelectPlace(place);
        setActivePopupPlace(place);
        map.panTo([place.lat, place.lng], { animate: true });
      });

      markersRef.current[place.id] = marker;
      bounds.push([place.lat, place.lng]);
    });

    // If there are places and no specific selected place, fit bounds nicely
    if (bounds.length > 1 && !selectedPlace) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (_) {}
    }
  }, [places, selectedPlace]);

  // Sync panTo when selectedPlace changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPlace) return;

    if (
      typeof selectedPlace.lat === 'number' &&
      typeof selectedPlace.lng === 'number' &&
      !isNaN(selectedPlace.lat) &&
      !isNaN(selectedPlace.lng)
    ) {
      map.panTo([selectedPlace.lat, selectedPlace.lng], { animate: true });
      setActivePopupPlace(selectedPlace);
    }
  }, [selectedPlace]);

  // Handle Zoom In
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  // Handle Zoom Out
  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Handle Fit All Places
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || places.length === 0) return;

    const coords = places
      .filter((p) => typeof p.lat === 'number' && !isNaN(p.lat))
      .map((p) => [p.lat, p.lng] as [number, number]);

    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Map Controls (Top Right) */}
      <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleFitAll}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          title="Fit All Locations"
        >
          <Maximize2 className="h-4 w-4 text-indigo-600" />
        </button>
      </div>

      {/* Map Attribution and Status indicator */}
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 shadow-xs backdrop-blur-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-slate-800">
          OpenStreetMap
        </span>
        <span className="text-[10px] text-slate-400">
          • {places.length} {places.length === 1 ? 'Pin' : 'Pins'}
        </span>
      </div>

      {/* Bottom Popup Card for Selected Place */}
      {activePopupPlace && (
        <div className="absolute bottom-4 left-4 right-4 z-30 mx-auto max-w-lg rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                  {activePopupPlace.category.replace('_', ' ')}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    activePopupPlace.status === 'favorite'
                      ? 'bg-amber-100 text-amber-800'
                      : activePopupPlace.status === 'visited'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {activePopupPlace.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {activePopupPlace.localizedName || activePopupPlace.name}
                </h4>
                {activePopupPlace.originalName &&
                  activePopupPlace.originalName !== (activePopupPlace.localizedName || activePopupPlace.name) && (
                    <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                      {activePopupPlace.originalName}
                    </span>
                  )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {activePopupPlace.localizedAddress || activePopupPlace.address}
              </p>
              {activePopupPlace.originalAddress &&
                activePopupPlace.originalAddress !== (activePopupPlace.localizedAddress || activePopupPlace.address) && (
                  <p className="text-[10px] text-slate-400 italic truncate">
                    Orig: {activePopupPlace.originalAddress}
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={() => {
                setActivePopupPlace(null);
                onSelectPlace(null);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {activePopupPlace.notes && (
            <p className="mt-2 text-xs italic text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
              "{activePopupPlace.notes}"
            </p>
          )}

          {/* Quick Actions Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            {/* Status changer buttons */}
            {onUpdateStatus && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activePopupPlace.id, 'want_to_visit')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    activePopupPlace.status === 'want_to_visit'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Mark as Want to Visit"
                >
                  Want to Visit
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activePopupPlace.id, 'visited')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    activePopupPlace.status === 'visited'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Mark as Visited"
                >
                  Visited
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activePopupPlace.id, 'favorite')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    activePopupPlace.status === 'favorite'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Mark as Favorite"
                >
                  Favorite
                </button>
              </div>
            )}

            {/* Edit and External Links */}
            <div className="flex items-center gap-1.5 ml-auto">
              {onOpenEditPlace && (
                <button
                  type="button"
                  onClick={() => onOpenEditPlace(activePopupPlace)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-colors"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </button>
              )}
              {onDeletePlace && (
                <button
                  type="button"
                  onClick={() => {
                    onDeletePlace(activePopupPlace.id);
                    setActivePopupPlace(null);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                  title="Delete Place"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  (activePopupPlace.localizedName || activePopupPlace.name) +
                    ' ' +
                    (activePopupPlace.localizedAddress || activePopupPlace.address)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                title="Open in Google Maps"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
