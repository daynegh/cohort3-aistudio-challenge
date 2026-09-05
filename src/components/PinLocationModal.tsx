import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  Bookmark,
  X,
  Check,
  Globe2,
  Navigation,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { PinnedJournalLocation, PlaceOfInterest } from '../types';
import { fetchUserPlaces } from '../services/placesService';

interface PinLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: PinnedJournalLocation) => void;
  currentLocation?: PinnedJournalLocation | null;
  userId: string;
}

export const PinLocationModal: React.FC<PinLocationModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'gps'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Saved Places State
  const [savedPlaces, setSavedPlaces] = useState<PlaceOfInterest[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // GPS / Coordinate State
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  // Selected Location for confirmation
  const [selectedLoc, setSelectedLoc] = useState<PinnedJournalLocation | null>(
    currentLocation || null
  );
  const [locationNote, setLocationNote] = useState(currentLocation?.notes || '');

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedLoc(currentLocation || null);
      setLocationNote(currentLocation?.notes || '');
      setSearchError(null);
      setGpsError(null);
    }
  }, [isOpen, currentLocation]);

  // Load user saved places when switching to 'saved' tab
  useEffect(() => {
    if (isOpen && activeTab === 'saved' && userId) {
      setIsLoadingSaved(true);
      fetchUserPlaces(userId)
        .then((places) => setSavedPlaces(places))
        .catch((err) => console.warn('Failed to load saved places for pinning:', err))
        .finally(() => setIsLoadingSaved(false));
    }
  }, [isOpen, activeTab, userId]);

  // Search handler with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setSearchResults(data.results);
        } else {
          setSearchResults([]);
        }
      } catch (err: any) {
        console.warn('Location search error:', err);
        setSearchError('Could not fetch locations. Please try again or use GPS/Coordinates.');
      } finally {
        setIsSearching(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Current Device GPS
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));

        try {
          const res = await fetch(`/api/places/reverse-geocode?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data = await res.json();
            const locName = data.localizedName || data.name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            const locAddr = data.localizedAddress || data.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

            setManualName(locName);
            setManualAddress(locAddr);

            setSelectedLoc({
              name: locName,
              originalName: data.originalName,
              localizedName: data.localizedName,
              address: locAddr,
              lat,
              lng,
              notes: locationNote,
            });
          } else {
            const defaultName = `Current Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            setManualName(defaultName);
            setSelectedLoc({
              name: defaultName,
              address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              lat,
              lng,
              notes: locationNote,
            });
          }
        } catch (revErr) {
          console.warn('Reverse geocoding error:', revErr);
          const defaultName = `Current Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setManualName(defaultName);
          setSelectedLoc({
            name: defaultName,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            lat,
            lng,
            notes: locationNote,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setGpsError(
          err.code === 1
            ? 'Permission denied. Please allow location access in your browser.'
            : 'Could not acquire GPS position. You can enter coordinates manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleApplyManualCoordinates = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGpsError('Please provide valid Latitude (-90 to 90) and Longitude (-180 to 180).');
      return;
    }
    const name = manualName.trim() || `Pinned Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    const address = manualAddress.trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    setSelectedLoc({
      name,
      address,
      lat,
      lng,
      notes: locationNote,
    });
    setGpsError(null);
  };

  const handleConfirm = () => {
    if (!selectedLoc) return;
    onSelectLocation({
      ...selectedLoc,
      notes: locationNote.trim(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="pin-location-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Pin Location to Reflection
              </h3>
              <p className="text-xs text-slate-500">
                Attach geographical context, inspiration spots, or travel memories to this journal entry.
              </p>
            </div>
          </div>
          <button
            id="close-pin-location-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            id="pin-tab-search"
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'search'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search Places</span>
          </button>

          <button
            id="pin-tab-saved"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'saved'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>My Saved Places ({savedPlaces.length})</span>
          </button>

          <button
            id="pin-tab-gps"
            onClick={() => setActiveTab('gps')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'gps'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>GPS & Coordinates</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: SEARCH PLACES */}
          {activeTab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="pin-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search a city, cafe, landmark, or foreign address (e.g., Tokyo Tower, Central Park, Shinjuku)..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-600" />
                )}
              </div>

              {searchError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Results List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {searchResults.length > 0 ? (
                  searchResults.map((result, idx) => {
                    const isCurrent =
                      selectedLoc?.lat === result.lat && selectedLoc?.lng === result.lng;
                    const hasOriginal =
                      result.originalName && result.originalName !== result.localizedName;

                    return (
                      <div
                        key={result.id || idx}
                        id={`search-result-${idx}`}
                        onClick={() => {
                          setSelectedLoc({
                            name: result.localizedName || result.name,
                            originalName: result.originalName,
                            localizedName: result.localizedName,
                            address: result.localizedAddress || result.address,
                            originalAddress: result.originalAddress,
                            localizedAddress: result.localizedAddress,
                            lat: result.lat,
                            lng: result.lng,
                            placeId: result.placeId || result.id,
                            category: result.category,
                            notes: locationNote,
                          });
                        }}
                        className={`group flex items-start justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                          isCurrent
                            ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-400'
                            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isCurrent
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                            }`}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-900">
                                {result.localizedName || result.name}
                              </span>
                              {hasOriginal && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                  <Globe2 className="h-2.5 w-2.5" />
                                  <span>{result.originalName}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {result.localizedAddress || result.address}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                            </p>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 shrink-0">
                            <Check className="h-4 w-4" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : searchQuery.trim().length >= 2 && !isSearching ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    No matching places found for "{searchQuery}". Try a broader term or use the GPS / Coordinates tab.
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 2: SAVED PLACES */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Choose a place from your Google Maps Places Tracker to link to this reflection:
              </p>

              {isLoadingSaved ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : savedPlaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <Bookmark className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-medium text-slate-700">No saved places yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Add places in the "Places to Visit" tab or search above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {savedPlaces.map((place) => {
                    const isCurrent =
                      selectedLoc?.lat === place.lat && selectedLoc?.lng === place.lng;
                    return (
                      <div
                        key={place.id}
                        id={`saved-place-item-${place.id}`}
                        onClick={() => {
                          setSelectedLoc({
                            name: place.localizedName || place.name,
                            originalName: place.originalName,
                            localizedName: place.localizedName,
                            address: place.localizedAddress || place.address,
                            originalAddress: place.originalAddress,
                            localizedAddress: place.localizedAddress,
                            lat: place.lat,
                            lng: place.lng,
                            placeId: place.placeId || place.id,
                            category: place.category,
                            notes: place.notes || locationNote,
                          });
                        }}
                        className={`group flex items-start justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                          isCurrent
                            ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-400'
                            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isCurrent
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                            }`}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-900">
                                {place.localizedName || place.name}
                              </span>
                              {place.originalName && place.originalName !== place.name && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                  <Globe2 className="h-2.5 w-2.5" />
                                  <span>{place.originalName}</span>
                                </span>
                              )}
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 capitalize">
                                {place.category.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {place.localizedAddress || place.address}
                            </p>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 shrink-0">
                            <Check className="h-4 w-4" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GPS & COORDINATES */}
          {activeTab === 'gps' && (
            <div className="space-y-4">
              {/* Device GPS button */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                    <Crosshair className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">
                      Use Current Device Location
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Pin where you are reflecting right now with high-accuracy GPS.
                    </p>
                  </div>
                </div>

                <button
                  id="get-device-gps-btn"
                  onClick={handleGetDeviceLocation}
                  disabled={isLocating}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Acquiring GPS...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="h-3.5 w-3.5" />
                      <span>Detect My Location</span>
                    </>
                  )}
                </button>
              </div>

              {gpsError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{gpsError}</span>
                </div>
              )}

              {/* Manual Coordinate Inputs */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <span className="text-xs font-semibold text-slate-800 block">
                  Or Enter Specific Coordinates:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      id="manual-lat-input"
                      type="number"
                      step="any"
                      placeholder="e.g. 35.6586"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      id="manual-lng-input"
                      type="number"
                      step="any"
                      placeholder="e.g. 139.7454"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Custom Place Name (Optional)
                    </label>
                    <input
                      id="manual-name-input"
                      type="text"
                      placeholder="e.g. Morning Riverbank Bench"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Address / Description (Optional)
                    </label>
                    <input
                      id="manual-address-input"
                      type="text"
                      placeholder="e.g. Near Sumida River Walkway"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  id="apply-coordinates-btn"
                  onClick={handleApplyManualCoordinates}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Apply Coordinates
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE SELECTION & CONTEXT NOTE */}
          {selectedLoc && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 block">
                      Pinned Location Preview
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedLoc.localizedName || selectedLoc.name}
                    </h4>
                    {selectedLoc.originalName && selectedLoc.originalName !== selectedLoc.name && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 mt-1">
                        <Globe2 className="h-2.5 w-2.5" />
                        <span>Native Script: {selectedLoc.originalName}</span>
                      </span>
                    )}
                    <p className="text-xs text-slate-600 mt-1">{selectedLoc.address}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Coordinates: {selectedLoc.lat.toFixed(6)}, {selectedLoc.lng.toFixed(6)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLoc(null)}
                  className="text-xs text-slate-400 hover:text-rose-600 font-medium"
                >
                  Clear
                </button>
              </div>

              {/* Personal Context Note */}
              <div className="border-t border-indigo-100 pt-3">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Reflection Context Note (Optional):
                </label>
                <input
                  id="pin-context-note-input"
                  type="text"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="e.g., Where I made the career decision; peaceful morning coffee spot..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <button
            id="cancel-pin-btn"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            id="confirm-pin-location-btn"
            onClick={handleConfirm}
            disabled={!selectedLoc}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Attach Pinned Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
