import React, { useState, useEffect } from 'react';
import {
  X,
  Navigation,
  Sparkles,
  Footprints,
  Car,
  Bus,
  Bike,
  ArrowUpDown,
  Trash2,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Milestone,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { PlaceOfInterest, ItineraryStop, ItineraryRoute } from '../types';

interface ItineraryRouteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stops: ItineraryStop[];
  onUpdateStops: (stops: ItineraryStop[]) => void;
  availablePlaces: PlaceOfInterest[];
  currentRoute: ItineraryRoute | null;
  onRouteCalculated: (route: ItineraryRoute | null) => void;
  onFocusStopOnMap?: (stop: ItineraryStop) => void;
}

export const ItineraryRouteDrawer: React.FC<ItineraryRouteDrawerProps> = ({
  isOpen,
  onClose,
  stops,
  onUpdateStops,
  availablePlaces,
  currentRoute,
  onRouteCalculated,
  onFocusStopOnMap,
}) => {
  const [travelMode, setTravelMode] = useState<'WALK' | 'DRIVE' | 'TRANSIT' | 'BICYCLE'>('WALK');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [showAddDropdown, setShowAddDropdown] = useState<boolean>(false);
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);

  // Calculate route when stops or travel mode change
  const computeRoute = async (optimize: boolean = false) => {
    if (stops.length < 2) {
      onRouteCalculated(null);
      return;
    }

    if (optimize) setIsOptimizing(true);
    else setIsCalculating(true);

    try {
      const origin = stops[0];
      const destination = stops[stops.length - 1];
      const intermediates = stops.slice(1, -1);

      const res = await fetch('/api/places/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          intermediates,
          travelMode,
          optimizeWaypointOrder: optimize,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.route) {
          onRouteCalculated(data.route);

          if (optimize && data.route.stops && data.route.stops.length === stops.length) {
            onUpdateStops(data.route.stops);
            setOptimizationMessage('Itinerary stops reorganized for the most efficient travel path.');
            setTimeout(() => setOptimizationMessage(null), 4000);
          }
        }
      }
    } catch (err) {
      console.warn('Error calculating route:', err);
    } finally {
      setIsCalculating(false);
      setIsOptimizing(false);
    }
  };

  // Re-calculate when travel mode or stops change
  useEffect(() => {
    if (isOpen && stops.length >= 2) {
      computeRoute(false);
    } else if (stops.length < 2) {
      onRouteCalculated(null);
    }
  }, [travelMode, stops.length, isOpen]);

  if (!isOpen) return null;

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length) return;

    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;
    onUpdateStops(newStops);
  };

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    onUpdateStops(newStops);
  };

  const handleAddStopFromPlace = (place: PlaceOfInterest) => {
    const newStop: ItineraryStop = {
      id: place.id,
      name: place.localizedName || place.name,
      address: place.localizedAddress || place.address,
      lat: place.lat,
      lng: place.lng,
      placeId: place.placeId,
    };
    onUpdateStops([...stops, newStop]);
    setShowAddDropdown(false);
  };

  const unusedPlaces = availablePlaces.filter(
    (p) => !stops.some((s) => s.id === p.id || (s.lat === p.lat && s.lng === p.lng))
  );

  return (
    <div
      id="itinerary-route-drawer"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Itinerary & Route Planner
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google Routes API (New) • {stops.length} {stops.length === 1 ? 'Stop' : 'Stops'}
            </p>
          </div>
        </div>
        <button
          id="close-itinerary-drawer-btn"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Travel Mode Selector */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
          {[
            { mode: 'WALK', label: 'Walk', icon: Footprints },
            { mode: 'DRIVE', label: 'Drive', icon: Car },
            { mode: 'TRANSIT', label: 'Transit', icon: Bus },
            { mode: 'BICYCLE', label: 'Cycle', icon: Bike },
          ].map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              id={`travel-mode-${mode.toLowerCase()}-btn`}
              onClick={() => setTravelMode(mode as any)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                travelMode === mode
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Optimization Message */}
        {optimizationMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{optimizationMessage}</span>
          </div>
        )}

        {/* Route Summary Card (if active) */}
        {currentRoute && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100/80 dark:border-indigo-900/60 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Optimized Trip Overview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-medium">
                {currentRoute.source === 'google_routes' ? 'Google Routes (New)' : 'OSRM Router'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <div className="text-base font-bold text-slate-900 dark:text-white leading-none">
                    {currentRoute.totalDurationFormatted}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Est. Travel Time
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <Milestone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-base font-bold text-slate-900 dark:text-white leading-none">
                    {currentRoute.totalDistanceFormatted}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total Distance
                  </span>
                </div>
              </div>
            </div>

            {/* Google Maps Deep Link */}
            <a
              id="open-itinerary-google-maps-btn"
              href={currentRoute.googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-colors"
            >
              <span>Open Navigation in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Waypoints & Stops Sequence */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Trip Stops ({stops.length})
            </h3>
            {stops.length > 2 && (
              <button
                id="optimize-itinerary-order-btn"
                onClick={() => computeRoute(true)}
                disabled={isOptimizing || isCalculating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 transition-colors disabled:opacity-50"
              >
                {isOptimizing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>Optimize Stop Order</span>
              </button>
            )}
          </div>

          {stops.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No stops added to your itinerary yet. Click "Add to Itinerary" on any place or select from your saved places below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stops.map((stop, index) => {
                const isFirst = index === 0;
                const isLast = index === stops.length - 1;

                return (
                  <div
                    key={stop.id || index}
                    className="relative flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                  >
                    {/* Marker Badge */}
                    <div
                      onClick={() => onFocusStopOnMap && onFocusStopOnMap(stop)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer shadow-xs ${
                        isFirst
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-200 dark:ring-emerald-900'
                          : isLast
                          ? 'bg-rose-600 text-white ring-2 ring-rose-200 dark:ring-rose-900'
                          : 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:ring-indigo-900'
                      }`}
                      title="Click to center on map"
                    >
                      {index + 1}
                    </div>

                    {/* Stop Info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onFocusStopOnMap && onFocusStopOnMap(stop)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {stop.name}
                        </span>
                        {isFirst && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-medium">
                            Start
                          </span>
                        )}
                        {isLast && stops.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-medium">
                            End
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {stop.address}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                      {stops.length > 1 && (
                        <div className="flex flex-col">
                          <button
                            id={`move-up-stop-${index}`}
                            onClick={() => handleMoveStop(index, 'up')}
                            disabled={isFirst}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`move-down-stop-${index}`}
                            onClick={() => handleMoveStop(index, 'down')}
                            disabled={isLast}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <button
                        id={`remove-stop-${index}`}
                        onClick={() => handleRemoveStop(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Stop Dropdown */}
          <div className="relative">
            <button
              id="add-stop-dropdown-btn"
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800/80 hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stop from Saved Places</span>
            </button>

            {showAddDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 z-20 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-56 overflow-y-auto space-y-1">
                {unusedPlaces.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    All your saved places are currently in the itinerary.
                  </p>
                ) : (
                  unusedPlaces.map((place) => (
                    <button
                      key={place.id}
                      id={`select-place-stop-${place.id}`}
                      onClick={() => handleAddStopFromPlace(place)}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {place.localizedName || place.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {place.localizedAddress || place.address}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Turn-by-Turn Navigation Steps Accordion */}
        {currentRoute && currentRoute.legs && currentRoute.legs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 overflow-hidden shadow-xs">
            <button
              id="toggle-turn-by-turn-steps-btn"
              onClick={() => setShowSteps(!showSteps)}
              className="w-full flex items-center justify-between p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Turn-by-Turn Navigation Steps</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  showSteps ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showSteps && (
              <div className="p-4 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
                {currentRoute.legs.map((leg, lIdx) => (
                  <div key={lIdx} className="space-y-2">
                    <div className="flex items-center justify-between py-1 text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">
                      <span>Leg {lIdx + 1}: {leg.startName} → {leg.endName}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {leg.distanceFormatted} • {leg.durationFormatted}
                      </span>
                    </div>

                    <div className="space-y-1.5 pl-2">
                      {leg.steps.map((st, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <div>{st.instruction}</div>
                            <span className="text-[10px] text-slate-400">
                              {st.distanceFormatted} ({st.durationFormatted})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Action Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
        <button
          id="clear-all-itinerary-stops-btn"
          onClick={() => {
            onUpdateStops([]);
            onRouteCalculated(null);
          }}
          disabled={stops.length === 0}
          className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-40"
        >
          Clear All Stops
        </button>

        <button
          id="recalculate-route-btn"
          onClick={() => computeRoute(false)}
          disabled={stops.length < 2 || isCalculating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
        >
          {isCalculating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          <span>Update Route</span>
        </button>
      </div>
    </div>
  );
};
