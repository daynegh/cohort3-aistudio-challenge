import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { Search, MapPin, Plus, Loader2, X, Globe, Sparkles, Languages } from 'lucide-react';
import { PlaceCategory, PlaceVisitStatus, PlaceOfInterest } from '../types';
import { LocationCoordinatePicker } from './LocationCoordinatePicker';
import { requestLocationLocalization } from '../services/geminiService';

export interface PlaceSearchAutocompleteProps {
  onAddPlace: (place: Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onOpenManualAdd?: () => void;
}

export interface SearchResultItem {
  id: string;
  name: string;
  originalName?: string;
  localizedName?: string;
  address: string;
  originalAddress?: string;
  localizedAddress?: string;
  lat: number;
  lng: number;
  rating?: number;
  source?: 'google' | 'geocoding';
  category?: PlaceCategory;
}

interface PlaceSearchCoreProps extends PlaceSearchAutocompleteProps {
  map?: google.maps.Map | null;
  placesLib?: google.maps.PlacesLibrary | null;
  isStandalone?: boolean;
}

const PlaceSearchCore: React.FC<PlaceSearchCoreProps> = ({
  onAddPlace,
  onOpenManualAdd,
  map,
  placesLib,
  isStandalone = false,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchSource, setSearchSource] = useState<'google' | 'geocoding'>('google');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Add state for chosen place
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const [category, setCategory] = useState<PlaceCategory>('nature_parks');
  const [status, setStatus] = useState<PlaceVisitStatus>('want_to_visit');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Place manual fields
  const [customName, setCustomName] = useState('');
  const [customOriginalName, setCustomOriginalName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [customOriginalAddress, setCustomOriginalAddress] = useState('');
  const [customLat, setCustomLat] = useState('37.7749');
  const [customLng, setCustomLng] = useState('-122.4194');
  const [isLocalizingManual, setIsLocalizingManual] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger search when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setErrorMessage(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      let foundResults: SearchResultItem[] = [];

      // 1. First Attempt: Google Maps Places API (if active inside APIProvider)
      if (!isStandalone && placesLib) {
        try {
          if ((placesLib as any).Place && typeof (placesLib as any).Place.searchByText === 'function') {
            const request: any = {
              textQuery: trimmed,
              fields: ['displayName', 'formattedAddress', 'location', 'rating', 'id'],
            };
            if (map) {
              const center = map.getCenter();
              if (center) {
                request.locationBias = {
                  center: { lat: center.lat(), lng: center.lng() },
                  radius: 50000,
                };
              }
            }

            const response = await (placesLib as any).Place.searchByText(request);
            if (response && response.places && Array.isArray(response.places) && response.places.length > 0) {
              foundResults = response.places.map((p: any) => ({
                id: p.id || `gplace_${Math.random().toString(36).slice(2, 8)}`,
                name: p.displayName || trimmed,
                address: p.formattedAddress || 'Google Maps Verified Location',
                lat: typeof p.location?.lat === 'function' ? p.location.lat() : (p.location?.lat ?? 0),
                lng: typeof p.location?.lng === 'function' ? p.location.lng() : (p.location?.lng ?? 0),
                rating: p.rating,
                source: 'google' as const,
              }));

              setSearchResults(foundResults);
              setSearchSource('google');
              setIsSearching(false);
              return;
            }
          }
        } catch (googlePlacesErr) {
          console.warn('Google Places API search restriction/error; falling back smoothly to resilient location search:', googlePlacesErr);
        }
      }

      // 2. Resilient Fallback: Server-side geocoding endpoint (/api/places/search)
      try {
        const backendRes = await fetch(`/api/places/search?q=${encodeURIComponent(trimmed)}`);
        if (backendRes.ok) {
          const backendData = await backendRes.json();
          if (backendData?.results && Array.isArray(backendData.results) && backendData.results.length > 0) {
            foundResults = backendData.results.map((r: any) => ({
              id: r.id,
              name: r.localizedName || r.name,
              localizedName: r.localizedName || r.name,
              originalName: r.originalName || r.name,
              address: r.localizedAddress || r.address,
              localizedAddress: r.localizedAddress || r.address,
              originalAddress: r.originalAddress || r.address,
              lat: r.lat,
              lng: r.lng,
              category: r.category as PlaceCategory,
              source: 'geocoding' as const,
            }));

            setSearchResults(foundResults);
            setSearchSource('geocoding');
            setIsSearching(false);
            return;
          }
        }
      } catch (backendErr) {
        console.warn('Backend geocoding search failed, attempting direct Photon fallback:', backendErr);
      }

      // 3. Client-side direct fallback: Photon OpenStreetMap search with &lang=en
      try {
        const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=8&lang=en`);
        if (photonRes.ok) {
          const photonData: any = await photonRes.json();
          if (photonData?.features && Array.isArray(photonData.features) && photonData.features.length > 0) {
            foundResults = photonData.features
              .map((f: any) => {
                const p = f.properties || {};
                const name = p.name || p.street || trimmed;
                const origName = p.extra?.['name'] || p.name || trimmed;
                const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
                const address = [streetLine, p.locality || p.district, p.city, p.state, p.country]
                  .filter(Boolean)
                  .join(', ');

                return {
                  id: `osm_${p.osm_type || 'W'}_${p.osm_id || Math.random().toString(36).slice(2, 8)}`,
                  name,
                  localizedName: name,
                  originalName: origName,
                  address: address || p.country || trimmed,
                  localizedAddress: address || p.country || trimmed,
                  originalAddress: address || p.country || trimmed,
                  lat: f.geometry?.coordinates?.[1] ?? 0,
                  lng: f.geometry?.coordinates?.[0] ?? 0,
                  source: 'geocoding' as const,
                };
              })
              .filter((r: any) => r.lat !== 0 && r.lng !== 0);

            if (foundResults.length > 0) {
              setSearchResults(foundResults);
              setSearchSource('geocoding');
              setIsSearching(false);
              return;
            }
          }
        }
      } catch (directPhotonErr) {
        console.warn('Direct Photon fallback error:', directPhotonErr);
      }

      // If no locations were matched anywhere
      setSearchResults([]);
      setIsSearching(false);
      setErrorMessage(`No matching places found for "${trimmed}". You can add this location using "Add Manually".`);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, placesLib, map, isStandalone]);

  const handleSelectResult = (result: SearchResultItem) => {
    setSelectedResult(result);
    setNotes('');
    setStatus('want_to_visit');

    if (result.category) {
      setCategory(result.category);
    } else {
      // Intelligent default category based on name
      const lowerName = result.name.toLowerCase();
      if (
        lowerName.includes('park') ||
        lowerName.includes('garden') ||
        lowerName.includes('beach') ||
        lowerName.includes('trail') ||
        lowerName.includes('mount') ||
        lowerName.includes('lake') ||
        lowerName.includes('forest')
      ) {
        setCategory('nature_parks');
      } else if (
        lowerName.includes('cafe') ||
        lowerName.includes('coffee') ||
        lowerName.includes('restaurant') ||
        lowerName.includes('bistro') ||
        lowerName.includes('bar') ||
        lowerName.includes('bakery') ||
        lowerName.includes('tea')
      ) {
        setCategory('cafes_food');
      } else if (
        lowerName.includes('museum') ||
        lowerName.includes('gallery') ||
        lowerName.includes('theater') ||
        lowerName.includes('theatre') ||
        lowerName.includes('art')
      ) {
        setCategory('arts_culture');
      } else if (
        lowerName.includes('castle') ||
        lowerName.includes('temple') ||
        lowerName.includes('shrine') ||
        lowerName.includes('monument') ||
        lowerName.includes('historic') ||
        lowerName.includes('palace')
      ) {
        setCategory('historical');
      } else if (
        lowerName.includes('hotel') ||
        lowerName.includes('resort') ||
        lowerName.includes('inn') ||
        lowerName.includes('lodge') ||
        lowerName.includes('hostel')
      ) {
        setCategory('travel_lodging');
      } else {
        setCategory('other');
      }
    }

    if (map && result.lat && result.lng) {
      map.panTo({ lat: result.lat, lng: result.lng });
      map.setZoom(14);
    }
  };

  const handleConfirmAddSelected = async () => {
    if (!selectedResult) return;
    setIsSubmitting(true);
    try {
      const primaryName = selectedResult.localizedName || selectedResult.name;
      const primaryAddress = selectedResult.localizedAddress || selectedResult.address;

      await onAddPlace({
        name: primaryName,
        localizedName: primaryName,
        originalName: selectedResult.originalName,
        address: primaryAddress,
        localizedAddress: primaryAddress,
        originalAddress: selectedResult.originalAddress,
        lat: selectedResult.lat,
        lng: selectedResult.lng,
        placeId: selectedResult.id,
        category,
        status,
        notes: notes.trim(),
        rating: selectedResult.rating,
      });
      setSelectedResult(null);
      setQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to add place:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoLocalizeManual = async () => {
    if (!customName.trim() && !customAddress.trim()) return;
    setIsLocalizingManual(true);
    try {
      const latNum = parseFloat(customLat);
      const lngNum = parseFloat(customLng);
      const res = await requestLocationLocalization({
        name: customName.trim(),
        address: customAddress.trim(),
        lat: isNaN(latNum) ? undefined : latNum,
        lng: isNaN(lngNum) ? undefined : lngNum,
      });

      if (res && res.hasLocalization) {
        if (!customOriginalName.trim() && res.originalName && res.originalName !== res.localizedName) {
          setCustomOriginalName(res.originalName);
        }
        if (!customOriginalAddress.trim() && res.originalAddress && res.originalAddress !== res.localizedAddress) {
          setCustomOriginalAddress(res.originalAddress);
        }
        setCustomName(res.localizedName);
        if (res.localizedAddress) {
          setCustomAddress(res.localizedAddress);
        }
      }
    } catch (err) {
      console.warn('Auto localization error:', err);
    } finally {
      setIsLocalizingManual(false);
    }
  };

  const handleSaveCustomPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const latNum = parseFloat(customLat);
    const lngNum = parseFloat(customLng);

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      alert('Please provide valid geographical coordinates (Latitude -90 to 90, Longitude -180 to 180).');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryName = customName.trim();
      const primaryAddress = customAddress.trim() || `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;

      await onAddPlace({
        name: primaryName,
        localizedName: primaryName,
        originalName: customOriginalName.trim() || undefined,
        address: primaryAddress,
        localizedAddress: primaryAddress,
        originalAddress: customOriginalAddress.trim() || undefined,
        lat: latNum,
        lng: lngNum,
        category,
        status,
        notes: notes.trim(),
      });
      setIsCustomModalOpen(false);
      setCustomName('');
      setCustomOriginalName('');
      setCustomAddress('');
      setCustomOriginalAddress('');
      setNotes('');
      if (map) {
        map.panTo({ lat: latNum, lng: lngNum });
        map.setZoom(13);
      }
    } catch (err) {
      console.error('Failed to save manual place:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="place-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination, cafe, park, or landmark worldwide..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSearchResults([]);
                setErrorMessage(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          id="custom-place-btn"
          type="button"
          onClick={() => {
            if (onOpenManualAdd) {
              onOpenManualAdd();
            } else {
              setIsCustomModalOpen(true);
            }
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
          title="Add a custom place or specific coordinates"
        >
          <Plus className="h-4 w-4 text-indigo-600" />
          <span className="hidden sm:inline">Add Manually</span>
        </button>
      </div>

      {/* Loading Indicator */}
      {isSearching && (
        <div className="absolute z-50 mt-1.5 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Searching destinations & places...</span>
        </div>
      )}

      {/* Notice message (only if truly nothing found) */}
      {errorMessage && !isSearching && query && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && !selectedResult && (
        <div className="absolute z-50 mt-1.5 max-h-76 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-2.5 text-[11px] font-semibold tracking-wider text-slate-500">
            <span className="uppercase">
              {searchSource === 'google' ? 'Google Maps Results' : 'Worldwide Location Results'} ({searchResults.length})
            </span>
            <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {searchSource === 'google' ? (
                <>
                  <MapPin className="h-3 w-3" />
                  <span>Google Places</span>
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  <span>Global Geocoding</span>
                </>
              )}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {searchResults.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelectResult(res)}
                className="flex w-full items-start gap-3 p-3 text-left hover:bg-indigo-50/60 transition-colors"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {res.localizedName || res.name}
                      </p>
                      {res.originalName && res.originalName !== (res.localizedName || res.name) && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium border border-slate-200">
                          {res.originalName}
                        </span>
                      )}
                    </div>
                    {res.rating ? (
                      <span className="ml-2 shrink-0 text-xs font-medium text-amber-600">
                        ★ {res.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="ml-2 shrink-0 text-[10px] text-slate-400 font-mono">
                        {res.lat.toFixed(2)}, {res.lng.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{res.localizedAddress || res.address}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Add Selected Search Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Add to Places to Visit</h3>
                  <p className="text-xs text-slate-500">Track and save to your private Firestore list</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <h4 className="font-semibold text-slate-900 text-sm">
                  {selectedResult.localizedName || selectedResult.name}
                </h4>
                {selectedResult.originalName && selectedResult.originalName !== (selectedResult.localizedName || selectedResult.name) && (
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600 font-medium border border-slate-200" title="Original text">
                    Orig: {selectedResult.originalName}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{selectedResult.localizedAddress || selectedResult.address}</p>
              {selectedResult.originalAddress && selectedResult.originalAddress !== (selectedResult.localizedAddress || selectedResult.address) && (
                <p className="mt-0.5 text-[11px] text-slate-400 italic">Original: {selectedResult.originalAddress}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                <span>Lat: {selectedResult.lat.toFixed(4)}</span>
                <span>Lng: {selectedResult.lng.toFixed(4)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="nature_parks">Nature & Parks</option>
                  <option value="cafes_food">Cafes & Dining</option>
                  <option value="arts_culture">Arts & Culture</option>
                  <option value="historical">Historical Landmarks</option>
                  <option value="travel_lodging">Lodging & Retreats</option>
                  <option value="activities">Outdoor Activities</option>
                  <option value="other">Other Points of Interest</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-700">Visit Status</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('want_to_visit')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      status === 'want_to_visit'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Want to Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('visited')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      status === 'visited'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Visited
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('favorite')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      status === 'favorite'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Favorite ★
                  </button>
                </div>
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Personal Notes / Why you want to visit
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Recommended for sunset meditation, great coffee roastery, or quiet nature walk..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedResult(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddSelected}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Save Place</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Place Manually Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Add Place Manually</h3>
                  <p className="text-xs text-slate-500">Track any spot with custom coordinates or address</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomPlace} className="mt-4 space-y-3.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">
                    Place Name (English) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoLocalizeManual}
                    disabled={isLocalizingManual || (!customName && !customAddress)}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                    title="Translate or format into English while saving original text"
                  >
                    {isLocalizingManual ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Languages className="h-3 w-3" />
                    )}
                    <span>Localize in English</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Tokyo Tower (English)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Original Name / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customOriginalName}
                  onChange={(e) => setCustomOriginalName(e.target.value)}
                  placeholder="e.g. 東京タワー"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Address / City (English)
                </label>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="e.g. 4-2-8 Shibakoen, Minato City, Tokyo"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Original Address / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customOriginalAddress}
                  onChange={(e) => setCustomOriginalAddress(e.target.value)}
                  placeholder="e.g. 東京都港区芝公園４丁目２−８"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Interactive Pin on Map */}
              <LocationCoordinatePicker
                lat={customLat}
                lng={customLng}
                onChangeCoordinates={(newLat, newLng) => {
                  setCustomLat(String(newLat));
                  setCustomLng(String(newLng));
                }}
                onAddressDetected={(detectedAddr) => {
                  if (!customAddress.trim()) {
                    setCustomAddress(detectedAddr);
                  }
                }}
                onLocationDetailsDetected={(details) => {
                  if (!customName.trim()) {
                    setCustomName(details.localizedName);
                  }
                  if (!customOriginalName.trim() && details.originalName && details.originalName !== details.localizedName) {
                    setCustomOriginalName(details.originalName);
                  }
                  if (!customAddress.trim() && details.localizedAddress) {
                    setCustomAddress(details.localizedAddress);
                  }
                  if (!customOriginalAddress.trim() && details.originalAddress && details.originalAddress !== details.localizedAddress) {
                    setCustomOriginalAddress(details.originalAddress);
                  }
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="nature_parks">Nature & Parks</option>
                    <option value="cafes_food">Cafes & Dining</option>
                    <option value="arts_culture">Arts & Culture</option>
                    <option value="historical">Historical Landmarks</option>
                    <option value="travel_lodging">Lodging & Retreats</option>
                    <option value="activities">Outdoor Activities</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PlaceVisitStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="want_to_visit">Want to Visit</option>
                    <option value="visited">Visited</option>
                    <option value="favorite">Favorite ★</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes / Intent</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about visiting this place..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Place</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to use inside <APIProvider>
export const PlaceSearchAutocomplete: React.FC<PlaceSearchAutocompleteProps> = (props) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  return <PlaceSearchCore {...props} map={map} placesLib={placesLib} isStandalone={false} />;
};

// Component to use outside <APIProvider> (Fallback view without Google Maps API Provider)
export const StandalonePlaceSearch: React.FC<PlaceSearchAutocompleteProps> = (props) => {
  return <PlaceSearchCore {...props} map={null} placesLib={null} isStandalone={true} />;
};
