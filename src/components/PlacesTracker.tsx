import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Plus,
  Filter,
  Sparkles,
  Navigation,
  Compass,
  Key,
  ExternalLink,
  Layers,
  Star,
  CheckCircle2,
  Bookmark,
  RefreshCw,
  Loader2,
  Info,
  Maximize2,
  AlertTriangle,
  Edit3,
  X,
  Copy,
  Check,
  ShieldAlert,
  HelpCircle,
  FolderHeart,
  ListFilter,
  PlusCircle,
} from 'lucide-react';
import { PlaceOfInterest, PlaceCategory, PlaceVisitStatus, PlaceList } from '../types';
import {
  subscribeToUserPlaces,
  savePlaceOfInterest,
  deletePlaceOfInterest,
  updatePlaceOfInterest,
  updatePlaceStatus,
  updatePlaceNotes,
  subscribeToUserLists,
  savePlaceList,
  updatePlaceList,
  deletePlaceList,
  STARTER_DEFAULT_LISTS,
} from '../services/placesService';
import { PlaceSearchAutocomplete, StandalonePlaceSearch } from './PlaceSearchAutocomplete';
import { PlaceCard } from './PlaceCard';
import { ManualAddPlaceModal } from './ManualAddPlaceModal';
import { EditPlaceModal } from './EditPlaceModal';
import { ManageListsModal, getListColorClasses, getListIconComponent } from './ManageListsModal';
import { LeafletPlacesMap } from './LeafletPlacesMap';
import { requestGeminiPlaceSuggestions, SuggestedPlace } from '../services/geminiService';

interface PlacesTrackerProps {
  user: User;
}

// Controller component to manipulate map camera safely
const MapController: React.FC<{
  selectedPlace: PlaceOfInterest | null;
  places: PlaceOfInterest[];
  triggerFit: number;
}> = ({ selectedPlace, places, triggerFit }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedPlace) return;
    if (
      typeof selectedPlace.lat === 'number' &&
      typeof selectedPlace.lng === 'number' &&
      !isNaN(selectedPlace.lat) &&
      !isNaN(selectedPlace.lng)
    ) {
      map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      map.setZoom(14);
    }
  }, [map, selectedPlace]);

  useEffect(() => {
    if (!map || places.length === 0 || triggerFit === 0) return;
    try {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.LatLngBounds) {
        const bounds = new (window as any).google.maps.LatLngBounds();
        let validCoordsCount = 0;
        places.forEach((p) => {
          if (
            typeof p.lat === 'number' &&
            typeof p.lng === 'number' &&
            !isNaN(p.lat) &&
            !isNaN(p.lng)
          ) {
            bounds.extend({ lat: p.lat, lng: p.lng });
            validCoordsCount++;
          }
        });
        if (validCoordsCount > 0) {
          map.fitBounds(bounds, 50);
        }
      }
    } catch (err) {
      console.warn('Map fit bounds notice:', err);
    }
  }, [map, places, triggerFit]);

  return null;
};

// Curated starter places for instant testing with localized and original script
const CURATED_SAMPLE_PLACES: Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Fushimi Inari Shrine',
    localizedName: 'Fushimi Inari Shrine',
    originalName: '伏見稲荷大社',
    address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, Japan',
    localizedAddress: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, Japan',
    originalAddress: '京都府京都市伏見区深草藪之内町68',
    lat: 34.9671,
    lng: 135.7727,
    category: 'historical',
    status: 'want_to_visit',
    notes: 'Walk the thousands of vermilion torii gates winding up Mount Inari forest.',
    rating: 4.9,
  },
  {
    name: 'Tokyo Tower',
    localizedName: 'Tokyo Tower',
    originalName: '東京タワー',
    address: '4-2-8 Shibakoen, Minato City, Tokyo, Japan',
    localizedAddress: '4-2-8 Shibakoen, Minato City, Tokyo, Japan',
    originalAddress: '東京都港区芝公園４丁目２−８',
    lat: 35.6586,
    lng: 139.7454,
    category: 'historical',
    status: 'favorite',
    notes: 'Iconic communications tower offering 360-degree views of Tokyo skyline and Mt Fuji.',
    rating: 4.8,
  },
  {
    name: 'Golden Gate Bridge Vista Point',
    localizedName: 'Golden Gate Bridge Vista Point',
    address: 'Sausalito, CA 94965, United States',
    localizedAddress: 'Sausalito, CA 94965, United States',
    lat: 37.8324,
    lng: -122.4795,
    category: 'nature_parks',
    status: 'want_to_visit',
    notes: 'Breathtaking vantage point for early morning contemplation and photography.',
    rating: 4.8,
  },
  {
    name: 'Eiffel Tower',
    localizedName: 'Eiffel Tower',
    originalName: 'Tour Eiffel',
    address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
    localizedAddress: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
    originalAddress: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
    lat: 48.8584,
    lng: 2.2945,
    category: 'historical',
    status: 'visited',
    notes: 'Iconic iron lattice tower on the Champ de Mars.',
    rating: 4.7,
  },
];

export const PlacesTracker: React.FC<PlacesTrackerProps> = ({ user }) => {
  const [places, setPlaces] = useState<PlaceOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters & Selection
  const [statusFilter, setStatusFilter] = useState<'all' | PlaceVisitStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PlaceCategory>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceOfInterest | null>(null);
  const [triggerFit, setTriggerFit] = useState(0);

  // Custom Multi-Lists State
  const [lists, setLists] = useState<PlaceList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isManageListsModalOpen, setIsManageListsModalOpen] = useState(false);

  // API Key management
  const envApiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [serverApiKey, setServerApiKey] = useState('');
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('user_gmp_api_key') || '';
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(() => {
    return localStorage.getItem('user_gmp_api_key') || envApiKey;
  });
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [placeBeingEdited, setPlaceBeingEdited] = useState<PlaceOfInterest | null>(null);
  const [mapAuthError, setMapAuthError] = useState<string | null>(null);
  const [keySaveSuccess, setKeySaveSuccess] = useState(false);

  // Check server-provided Google Maps API key on mount
  useEffect(() => {
    fetch('/api/config/maps')
      .then((res) => res.json())
      .then((data) => {
        if (data?.hasMapsKey && data?.apiKey) {
          setServerApiKey(data.apiKey);
        }
      })
      .catch((err) => {
        console.warn('Google Maps server config check notice:', err);
      });
  }, []);

  // Compute active API key with clear priority: User Custom Key > Server Env Key > Vite Client Env Key
  const activeApiKey = (
    customApiKey ||
    serverApiKey ||
    envApiKey ||
    ''
  ).trim();

  const isApiKeyValid = Boolean(
    activeApiKey &&
    activeApiKey.length > 10 &&
    activeApiKey !== 'MY_GOOGLE_MAPS_API_KEY' &&
    !activeApiKey.includes('MY_GOOGLE_MAPS_API_KEY')
  );

  const isUsingCustomKey = Boolean(
    customApiKey &&
    customApiKey.length > 10 &&
    customApiKey !== 'MY_GOOGLE_MAPS_API_KEY'
  );

  const isUsingEnvKey = Boolean(!isUsingCustomKey && (serverApiKey || envApiKey) && isApiKeyValid);

  const [copiedDomain, setCopiedDomain] = useState(false);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const recommendedDomainPattern = currentOrigin ? `${currentOrigin}/*` : 'https://*.run.app/*';

  // Capture global Google Maps Auth Failure (RefererNotAllowedMapError, ApiNotActivatedMapError, ApiProjectMapError)
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps API authentication error (gm_authFailure) intercepted.');
      setMapAuthError(
        `Google Maps Auth Error on ${window.location.hostname}: The API key was rejected by Google Maps Platform. Common causes: 1) HTTP Referrer restriction in Google Cloud Console is missing this published domain, 2) Maps JavaScript API or Places API (New) is not enabled, or 3) Billing is inactive.`
      );
      if (typeof originalAuthFailure === 'function') {
        try {
          originalAuthFailure();
        } catch (_) {}
      }
    };
    return () => {
      (window as any).gm_authFailure = originalAuthFailure;
    };
  }, []);

  // Gemini Place Suggestions
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCity, setAiCity] = useState('');
  const [aiMood, setAiMood] = useState('Inspiring & Serene');
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedPlace[]>([]);

  // Keyboard shortcut listener to close any open modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isApiKeyModalOpen) setIsApiKeyModalOpen(false);
        if (isAiModalOpen) setIsAiModalOpen(false);
        if (isManualModalOpen) setIsManualModalOpen(false);
        if (placeBeingEdited) setPlaceBeingEdited(null);
        if (isManageListsModalOpen) setIsManageListsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isApiKeyModalOpen, isAiModalOpen, isManualModalOpen, placeBeingEdited, isManageListsModalOpen]);

  // 1. Subscribe to Firestore Places collection for this user
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeToUserPlaces(
      user.uid,
      (fetched) => {
        setPlaces(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load places:', err);
        setErrorBanner('Failed to load your places of interest from Firestore.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // 2. Subscribe to Firestore Lists collection for this user
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const unsubscribe = subscribeToUserLists(
      user.uid,
      async (fetched) => {
        if (!isMounted) return;
        if (fetched.length === 0) {
          // Auto-seed starter lists so user immediately has collections
          const seededLists: PlaceList[] = [];
          for (const starter of STARTER_DEFAULT_LISTS) {
            const newList: PlaceList = {
              ...starter,
              userId: user.uid,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            try {
              await savePlaceList(user.uid, newList);
              seededLists.push(newList);
            } catch (seedErr) {
              console.warn('Starter list seed notice:', seedErr);
            }
          }
          if (seededLists.length > 0 && isMounted) {
            setLists(seededLists);
          }
        } else {
          setLists(fetched);
        }
      },
      (err) => {
        console.warn('Failed to load custom lists:', err);
      }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  // Handle List CRUD
  const handleCreateList = async (
    newList: Omit<PlaceList, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const listId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullList: PlaceList = {
      ...newList,
      id: listId,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePlaceList(user.uid, fullList);
    setActiveListId(listId);
  };

  const handleUpdateList = async (
    listId: string,
    updates: Partial<Omit<PlaceList, 'id' | 'userId' | 'createdAt'>>
  ) => {
    await updatePlaceList(user.uid, listId, updates);
  };

  const handleDeleteList = async (listId: string) => {
    await deletePlaceList(user.uid, listId);
    if (activeListId === listId) {
      setActiveListId(null);
    }
  };

  const handleQuickAssignList = async (placeId: string, targetListId: string | undefined) => {
    try {
      await updatePlaceOfInterest(user.uid, placeId, {
        listId: targetListId || undefined,
        listIds: targetListId ? [targetListId] : [],
      });
      if (selectedPlace?.id === placeId) {
        setSelectedPlace((prev) =>
          prev
            ? {
                ...prev,
                listId: targetListId || undefined,
                listIds: targetListId ? [targetListId] : [],
              }
            : null
        );
      }
    } catch (err: any) {
      console.error('Failed to update place list assignment:', err);
      setErrorBanner('Failed to update list assignment.');
    }
  };

  // Handle adding place to Firestore
  const handleAddPlace = async (
    newPlace: Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const id = `place_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullPlace: PlaceOfInterest = {
      ...newPlace,
      id,
      userId: user.uid,
      listId: newPlace.listId || (activeListId || undefined),
      listIds: newPlace.listIds || (activeListId ? [activeListId] : undefined),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await savePlaceOfInterest(user.uid, fullPlace);
      setSelectedPlace(fullPlace);
    } catch (err: any) {
      console.error('Error saving place to Firestore:', err);
      setErrorBanner(err?.message || 'Failed to save place of interest.');
    }
  };

  // Handle status update
  const handleUpdateStatus = async (placeId: string, nextStatus: PlaceVisitStatus) => {
    try {
      await updatePlaceStatus(user.uid, placeId, nextStatus);
      if (selectedPlace?.id === placeId) {
        setSelectedPlace((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      setErrorBanner('Failed to update place status.');
    }
  };

  // Handle notes update
  const handleUpdateNotes = async (placeId: string, notes: string) => {
    try {
      await updatePlaceNotes(user.uid, placeId, notes);
      if (selectedPlace?.id === placeId) {
        setSelectedPlace((prev) => (prev ? { ...prev, notes } : null));
      }
    } catch (err: any) {
      setErrorBanner('Failed to update place notes.');
    }
  };

  // Handle comprehensive edit of place
  const handleSavePlaceEdits = async (
    placeId: string,
    updates: Partial<Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt'>>
  ) => {
    try {
      await updatePlaceOfInterest(user.uid, placeId, updates);
      if (selectedPlace?.id === placeId) {
        setSelectedPlace((prev) => (prev ? { ...prev, ...updates } : null));
      }
    } catch (err: any) {
      console.error('Failed to update place:', err);
      setErrorBanner(err?.message || 'Failed to update location details.');
      throw err;
    }
  };

  // Handle delete
  const handleDeletePlace = async (placeId: string) => {
    try {
      await deletePlaceOfInterest(user.uid, placeId);
      if (selectedPlace?.id === placeId) {
        setSelectedPlace(null);
      }
    } catch (err: any) {
      setErrorBanner('Failed to delete place.');
    }
  };

  // Load starter places with 1 click
  const handleLoadSamplePlaces = async () => {
    for (const sample of CURATED_SAMPLE_PLACES) {
      await handleAddPlace(sample);
    }
    setTriggerFit((c) => c + 1);
  };

  // Filtered places list
  const filteredPlaces = places.filter((p) => {
    if (activeListId !== null) {
      const pListId = p.listId || (p.listIds && p.listIds[0]);
      const matchesList = pListId === activeListId || (p.listIds && p.listIds.includes(activeListId));
      if (!matchesList) return false;
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName =
        p.name.toLowerCase().includes(q) ||
        (p.localizedName && p.localizedName.toLowerCase().includes(q)) ||
        (p.originalName && p.originalName.toLowerCase().includes(q));
      const matchAddress =
        p.address.toLowerCase().includes(q) ||
        (p.localizedAddress && p.localizedAddress.toLowerCase().includes(q)) ||
        (p.originalAddress && p.originalAddress.toLowerCase().includes(q));
      const matchNotes = p.notes?.toLowerCase().includes(q) || false;
      if (!matchName && !matchAddress && !matchNotes) return false;
    }
    return true;
  });

  // Calculate statistics & list counts
  const totalCount = places.length;
  const wantToVisitCount = places.filter((p) => p.status === 'want_to_visit').length;
  const visitedCount = places.filter((p) => p.status === 'visited').length;
  const favoriteCount = places.filter((p) => p.status === 'favorite').length;

  const placesCountByList = lists.reduce((acc, list) => {
    acc[list.id] = places.filter((p) => {
      const pListId = p.listId || (p.listIds && p.listIds[0]);
      return pListId === list.id || (p.listIds && p.listIds.includes(list.id));
    }).length;
    return acc;
  }, {} as Record<string, number>);

  const activeList = lists.find((l) => l.id === activeListId);

  // Pin styling by status
  const getPinProps = (status: PlaceVisitStatus) => {
    switch (status) {
      case 'visited':
        return { background: '#059669', borderColor: '#047857', glyphColor: '#ffffff' };
      case 'favorite':
        return { background: '#d97706', borderColor: '#b45309', glyphColor: '#ffffff' };
      case 'want_to_visit':
      default:
        return { background: '#4f46e5', borderColor: '#3730a3', glyphColor: '#ffffff' };
    }
  };

  // Save custom API key
  const handleSaveApiKey = (keyToSave?: string) => {
    const trimmed = (keyToSave !== undefined ? keyToSave : keyInput).trim();
    if (trimmed && trimmed !== 'MY_GOOGLE_MAPS_API_KEY') {
      setCustomApiKey(trimmed);
      localStorage.setItem('user_gmp_api_key', trimmed);
    } else {
      setCustomApiKey('');
      localStorage.removeItem('user_gmp_api_key');
    }
    setMapAuthError(null);
    setKeySaveSuccess(true);
    setTimeout(() => {
      setKeySaveSuccess(false);
      setIsApiKeyModalOpen(false);
    }, 600);
  };

  const handleClearApiKey = () => {
    setCustomApiKey('');
    localStorage.removeItem('user_gmp_api_key');
    setKeyInput('');
    setMapAuthError(null);
  };

  // Gemini AI Places Generation
  const handleGenerateAiSuggestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingSuggestions(true);
    setErrorBanner(null);
    try {
      const response = await requestGeminiPlaceSuggestions({
        topic: aiTopic || 'Serene and inspiring destinations for mindfulness',
        mood: aiMood,
        city: aiCity,
      });
      if (response && response.places) {
        setAiSuggestions(response.places);
      }
    } catch (err: any) {
      console.error('Failed to get Gemini suggestions:', err);
      setErrorBanner(err?.message || 'Failed to generate place ideas with Gemini.');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleAddAiSuggestion = async (sugg: SuggestedPlace) => {
    await handleAddPlace({
      name: sugg.name,
      address: sugg.address,
      lat: sugg.lat,
      lng: sugg.lng,
      category: (sugg.category as PlaceCategory) || 'nature_parks',
      status: 'want_to_visit',
      notes: sugg.reason,
    });
    setAiSuggestions((prev) => prev.filter((p) => p.name !== sugg.name));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Banner & Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <MapPin className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Places of Interest to Visit
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Powered by Google Maps Platform & Cloud Firestore. Track, explore, and link memorable locations with your reflections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Add Place Button */}
          <button
            id="manual-add-place-top-btn"
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-600" />
            <span>Add Place</span>
          </button>

          {/* AI Inspiration Generator */}
          <button
            id="ai-suggest-places-btn"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Inspiration</span>
          </button>

          {/* API Key Configuration Pill */}
          <button
            id="configure-gmp-key-btn"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Google Maps Platform API Key configuration"
          >
            <Key className="h-3.5 w-3.5 text-slate-500" />
            <span className="flex items-center gap-1.5">
              {isApiKeyValid && !mapAuthError ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{isUsingCustomKey ? 'Custom Key: Active' : isUsingEnvKey ? 'Env Key: Active' : 'Maps API: Active'}</span>
                </>
              ) : mapAuthError ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-rose-700 font-semibold">Maps: Auth Error</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Configure Maps Key</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-xs font-medium underline hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Google Maps Publishing / Auth Diagnostic Banner */}
      {mapAuthError && (
        <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 shadow-sm text-slate-900 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Google Maps Auth Error on Published App
                  </h4>
                  <span className="rounded-md bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    Auto-switched to OpenStreetMap
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Google Maps Platform returned an authentication error for <strong className="font-semibold text-slate-900">{typeof window !== 'undefined' ? window.location.hostname : 'this domain'}</strong>. All places, custom markers, and search continue working smoothly via OpenStreetMap.
                </p>

                {/* 3 Step Resolution Guidance */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/80 text-xs">
                  <div className="rounded-xl bg-white/80 p-2.5 border border-amber-200/70 shadow-2xs">
                    <span className="font-bold text-amber-950 block mb-1">1. HTTP Referrers</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      In Google Cloud Console, add this domain to Website restrictions:
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-800 truncate flex-1">
                        {recommendedDomainPattern}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(recommendedDomainPattern);
                            setCopiedDomain(true);
                            setTimeout(() => setCopiedDomain(false), 2000);
                          }
                        }}
                        className="shrink-0 rounded bg-indigo-50 border border-indigo-200 p-1 text-indigo-700 hover:bg-indigo-100 transition-colors"
                        title="Copy domain pattern"
                      >
                        {copiedDomain ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/80 p-2.5 border border-amber-200/70 shadow-2xs">
                    <span className="font-bold text-amber-950 block mb-1">2. Enable Cloud APIs</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Ensure <strong className="text-slate-800">Maps JavaScript API</strong> and <strong className="text-slate-800">Places API (New)</strong> are enabled on the GCP project.
                    </p>
                    <a
                      href="https://console.cloud.google.com/google/maps-apis/credentials?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:underline"
                    >
                      <span>Open GCP Credentials</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="rounded-xl bg-white/80 p-2.5 border border-amber-200/70 shadow-2xs">
                    <span className="font-bold text-amber-950 block mb-1">3. Or Use Demo Key</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Get a free Google Maps Demo Key with zero billing or domain restrictions required.
                    </p>
                    <a
                      href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:underline"
                    >
                      <span>Get Free Demo Key</span>
                      <Sparkles className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(true)}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                Update Maps Key
              </button>
              <button
                type="button"
                onClick={() => setMapAuthError(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline"
              >
                Dismiss notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'all'
              ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Saved</span>
            <Layers className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">{totalCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('want_to_visit')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'want_to_visit'
              ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-indigo-600">
            <span>Want to Visit</span>
            <Bookmark className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">{wantToVisitCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('visited')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'visited'
              ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-600">
            <span>Visited</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">{visitedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('favorite')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'favorite'
              ? 'border-amber-500 bg-amber-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600">
            <span>Favorites</span>
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">{favoriteCount}</p>
        </button>
      </div>

      {/* Custom Lists Selector & Navigation Ribbon */}
      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
              <FolderHeart className="h-4 w-4 text-indigo-600" />
              <span>Lists:</span>
            </span>

            {/* "All Places" Master Tab */}
            <button
              onClick={() => setActiveListId(null)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                activeListId === null
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Places</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeListId === null
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {totalCount}
              </span>
            </button>

            {/* Custom User Lists */}
            {lists.map((list) => {
              const IconComp = getListIconComponent(list.icon);
              const colorClasses = getListColorClasses(list.color);
              const isSelected = activeListId === list.id;
              const count = placesCountByList[list.id] || 0;

              return (
                <button
                  key={list.id}
                  onClick={() => setActiveListId(list.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all shrink-0 ${
                    isSelected
                      ? `${colorClasses.border} ${colorClasses.bg} ${colorClasses.text} shadow-xs font-bold ring-2 ${colorClasses.ring}`
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  title={list.description || list.name}
                >
                  <IconComp className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[140px]">{list.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/80 border border-slate-200/60 text-slate-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List Management Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={() => setIsManageListsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
              title="Create new list or edit existing lists"
            >
              <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />
              <span>Manage Lists</span>
            </button>
          </div>
        </div>

        {activeList && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800">Filtered View:</span>
              <span className="italic truncate">{activeList.description || `Showing places in "${activeList.name}"`}</span>
            </div>
            <button
              onClick={() => setActiveListId(null)}
              className="text-[11px] text-indigo-600 hover:underline shrink-0 ml-2"
            >
              Clear List Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Split Grid: Interactive Map + Places Management */}
      {isApiKeyValid && !mapAuthError ? (
        <APIProvider
          apiKey={activeApiKey}
          libraries={['places', 'marker']}
          onError={(err) => {
            console.warn('APIProvider error:', err);
            setMapAuthError('Google Maps JavaScript API could not be loaded. Please check your API key or use the free Maps Demo Key.');
          }}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Column: Search, Filters, and Place Cards (5 cols) */}
            <div className="space-y-4 lg:col-span-5">
              {/* Search Bar powered by Google Maps Places Autocomplete */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Find & Add Places
                </h3>
                <PlaceSearchAutocomplete
                  onAddPlace={handleAddPlace}
                  onOpenManualAdd={() => setIsManualModalOpen(true)}
                />
              </div>

              {/* Category Filter Chips & Search input */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Filter by Category
                  </span>
                  {categoryFilter !== 'all' && (
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'nature_parks', label: 'Nature' },
                    { id: 'cafes_food', label: 'Cafes' },
                    { id: 'arts_culture', label: 'Culture' },
                    { id: 'historical', label: 'Historic' },
                    { id: 'travel_lodging', label: 'Lodging' },
                    { id: 'activities', label: 'Activities' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id as any)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        categoryFilter === cat.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Text Search in saved list */}
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter saved list by name or note..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Places List Container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Saved Locations ({filteredPlaces.length})
                  </span>
                  {places.length === 0 && !loading && (
                    <button
                      onClick={handleLoadSamplePlaces}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Load 4 Sample Places</span>
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                      <span className="text-xs text-slate-500">Loading places from Firestore...</span>
                    </div>
                  </div>
                ) : filteredPlaces.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-slate-900">No places tracked yet</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Search for scenic spots, cafes, or landmarks above, or load sample places to get started.
                    </p>
                    <button
                      onClick={handleLoadSamplePlaces}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Load Sample Places of Interest</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                    {filteredPlaces.map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        isSelected={selectedPlace?.id === place.id}
                        onSelect={(p) => setSelectedPlace(p)}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateNotes={handleUpdateNotes}
                        onDelete={handleDeletePlace}
                        onEdit={setPlaceBeingEdited}
                        lists={lists}
                        onQuickAssignList={handleQuickAssignList}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Interactive Google Map (7 cols) */}
            <div className="lg:col-span-7 sticky top-20">
              <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Map Floating Header Toolbar */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                  <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-md">
                    <Compass className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Google Maps Platform</span>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-1.5">
                    <button
                      onClick={() => setTriggerFit((c) => c + 1)}
                      className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-md hover:bg-slate-50"
                      title="Fit map view to all pins"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-slate-600" />
                      <span className="hidden sm:inline">Fit All Pins</span>
                    </button>
                  </div>
                </div>

                {/* Google Map Container with explicit CSS height as required */}
                <div className="h-[620px] w-full">
                  <Map
                    id="places-main-map"
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
                    defaultZoom={11}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                  >
                    <MapController
                      selectedPlace={selectedPlace}
                      places={filteredPlaces}
                      triggerFit={triggerFit}
                    />

                    {/* Advanced Markers for all filtered places */}
                    {filteredPlaces.map((place) => {
                      const pin = getPinProps(place.status);
                      return (
                        <AdvancedMarker
                          key={place.id}
                          position={{ lat: place.lat, lng: place.lng }}
                          title={place.name}
                          onClick={() => setSelectedPlace(place)}
                        >
                          <Pin
                            background={pin.background}
                            borderColor={pin.borderColor}
                            glyphColor={pin.glyphColor}
                          />
                        </AdvancedMarker>
                      );
                    })}

                    {/* InfoWindow for the selected place */}
                    {selectedPlace && (
                      <InfoWindow
                        position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                        onCloseClick={() => setSelectedPlace(null)}
                        headerDisabled={false}
                      >
                        <div className="p-1 max-w-[240px] text-slate-900">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100 uppercase">
                              {selectedPlace.category.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 capitalize">
                              • {selectedPlace.status.replace('_', ' ')}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">
                            {selectedPlace.localizedName || selectedPlace.name}
                          </h4>
                          {selectedPlace.originalName &&
                            selectedPlace.originalName !== (selectedPlace.localizedName || selectedPlace.name) && (
                              <div className="mt-1">
                                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                                  {selectedPlace.originalName}
                                </span>
                              </div>
                            )}
                          <p className="mt-1 text-xs text-slate-500 leading-snug">
                            {selectedPlace.localizedAddress || selectedPlace.address}
                          </p>
                          {selectedPlace.originalAddress &&
                            selectedPlace.originalAddress !== (selectedPlace.localizedAddress || selectedPlace.address) && (
                              <p className="mt-0.5 text-[10px] text-slate-400 italic leading-tight">
                                {selectedPlace.originalAddress}
                              </p>
                            )}
                          {selectedPlace.notes && (
                            <p className="mt-1.5 text-xs text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                              "{selectedPlace.notes}"
                            </p>
                          )}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${selectedPlace.localizedName || selectedPlace.name} ${selectedPlace.localizedAddress || selectedPlace.address}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Google Maps</span>
                            </a>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setPlaceBeingEdited(selectedPlace)}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors"
                                title="Edit place details"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  const nextStatus: Record<PlaceVisitStatus, PlaceVisitStatus> = {
                                    want_to_visit: 'visited',
                                    visited: 'favorite',
                                    favorite: 'want_to_visit',
                                  };
                                  handleUpdateStatus(selectedPlace.id, nextStatus[selectedPlace.status]);
                                }}
                                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium transition-colors"
                              >
                                Cycle Status
                              </button>
                            </div>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </div>

                {/* Map Legend Footer */}
                <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Legend:</span>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 inline-block" />
                      <span>Want to Visit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                      <span>Visited</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>Favorite ★</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Click any marker to view details & navigation
                  </div>
                </div>
              </div>
            </div>
          </div>
        </APIProvider>
      ) : (
        /* Fallback View: API Key Setup / Error Card + Places Management & Visual Overview */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Manual Add, Filters, and Place Cards */}
          <div className="space-y-4 lg:col-span-5">
            {/* Search Bar powered by Standalone Worldwide Place Search */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Find & Add Places
                </h3>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                  Worldwide Search
                </span>
              </div>
              <StandalonePlaceSearch
                onAddPlace={handleAddPlace}
                onOpenManualAdd={() => setIsManualModalOpen(true)}
              />
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Curate with Gemini AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  + Custom Coordinates
                </button>
              </div>
            </div>

            {/* Category Filter Chips & Search input */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Filter by Category
                </span>
                {categoryFilter !== 'all' && (
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'nature_parks', label: 'Nature' },
                  { id: 'cafes_food', label: 'Cafes' },
                  { id: 'arts_culture', label: 'Culture' },
                  { id: 'historical', label: 'Historic' },
                  { id: 'travel_lodging', label: 'Lodging' },
                  { id: 'activities', label: 'Activities' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id as any)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Text Search in saved list */}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter saved list by name or note..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Places List Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Saved Locations ({filteredPlaces.length})
                </span>
                {places.length === 0 && !loading && (
                  <button
                    onClick={handleLoadSamplePlaces}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Load 4 Sample Places</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    <span className="text-xs text-slate-500">Loading places from Firestore...</span>
                  </div>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-slate-900">No places tracked yet</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Add destinations manually or generate curated recommendations with Gemini AI.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => setIsManualModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Place Manually</span>
                    </button>
                    <button
                      onClick={handleLoadSamplePlaces}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                    >
                      <span>Load 4 Sample Places</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                  {filteredPlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      isSelected={selectedPlace?.id === place.id}
                      onSelect={(p) => setSelectedPlace(p)}
                      onUpdateStatus={handleUpdateStatus}
                      onUpdateNotes={handleUpdateNotes}
                      onDelete={handleDeletePlace}
                      onEdit={setPlaceBeingEdited}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Map & Engine Controls */}
          <div className="space-y-5 lg:col-span-7">
            {/* Interactive OpenStreetMap */}
            <LeafletPlacesMap
              places={filteredPlaces}
              selectedPlace={selectedPlace}
              onSelectPlace={(p) => setSelectedPlace(p)}
              onOpenEditPlace={(p) => setPlaceBeingEdited(p)}
              onDeletePlace={(id) => handleDeletePlace(id)}
              onUpdateStatus={(id, s) => handleUpdateStatus(id, s)}
            />

            {/* Map Engine Bar & Optional Google Maps Platform Integration */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      OpenStreetMap Interactive Engine
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Live interactive markers, draggable pins & worldwide geocoding
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Key className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Google Maps Key</span>
                  </button>
                  <a
                    href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    title="Get Free Maps Demo Key"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Demo Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {mapAuthError && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-950">Google Maps Status Notice:</span>
                        <p className="mt-0.5 text-[11px] text-amber-900 leading-relaxed">
                          {mapAuthError}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMapAuthError(null);
                        handleClearApiKey();
                      }}
                      className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-950 underline ml-2"
                    >
                      Clear & use OpenStreetMap
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tracked Locations Visual Overview Grid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Locations Overview ({filteredPlaces.length})
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    <span>Want to Visit</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span>Visited</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Favorite</span>
                  </span>
                </div>
              </div>

              {filteredPlaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <Compass className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No locations tracked yet</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use "+ Add Place Manually" or "AI Inspiration" to begin building your travel bucket list.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredPlaces.map((place) => (
                    <div
                      key={place.id}
                      className={`group relative rounded-xl border p-3.5 transition-all ${
                        selectedPlace?.id === place.id
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                          {place.category.replace('_', ' ')}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            place.status === 'favorite'
                              ? 'bg-amber-100 text-amber-800'
                              : place.status === 'visited'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {place.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="mt-2">
                        <h5 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {place.localizedName || place.name}
                        </h5>
                        {place.originalName && place.originalName !== (place.localizedName || place.name) && (
                          <span className="inline-block mt-0.5 rounded bg-white px-1.5 py-0.2 text-[9px] font-medium text-slate-600 border border-slate-200">
                            {place.originalName}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                        {place.localizedAddress || place.address}
                      </p>
                      {place.originalAddress && place.originalAddress !== (place.localizedAddress || place.address) && (
                        <p className="text-[10px] text-slate-400 italic line-clamp-1">
                          Orig: {place.originalAddress}
                        </p>
                      )}

                      <div className="mt-2 text-[10px] font-mono text-slate-400">
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                      </div>

                      {place.notes && (
                        <p className="mt-2 text-[11px] text-slate-600 italic line-clamp-2 bg-white p-1.5 rounded border border-slate-100">
                          "{place.notes}"
                        </p>
                      )}

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${place.localizedName || place.name} ${place.localizedAddress || place.address}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Google Maps</span>
                        </a>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPlaceBeingEdited(place)}
                            className="text-[10px] text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white transition-colors"
                            title="Edit location details"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus: Record<PlaceVisitStatus, PlaceVisitStatus> = {
                                want_to_visit: 'visited',
                                visited: 'favorite',
                                favorite: 'want_to_visit',
                              };
                              handleUpdateStatus(place.id, nextStatus[place.status]);
                            }}
                            className="text-[10px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-medium transition-colors"
                          >
                            Cycle Status
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Place Inspiration Modal */}
      {isAiModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAiModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    AI Place Recommendations
                  </h3>
                  <p className="text-xs text-slate-500">
                    Curated by Gemini 3.6 Flash based on your mindset and interests
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateAiSuggestions} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Target Destination / City (Optional)
                </label>
                <input
                  type="text"
                  value={aiCity}
                  onChange={(e) => setAiCity(e.target.value)}
                  placeholder="e.g. San Francisco, Kyoto, Paris, or Leave empty for general"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Themes / Interests / Reflection Topic
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Quiet coastal redwoods, cozy bookstore cafe, peaceful meditation gardens..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Mindset / Mood</label>
                <select
                  value={aiMood}
                  onChange={(e) => setAiMood(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="Inspiring & Serene">Inspiring & Serene</option>
                  <option value="Adventurous & Curious">Adventurous & Curious</option>
                  <option value="Cozy & Reflective">Cozy & Reflective</option>
                  <option value="Artistic & Creative">Artistic & Creative</option>
                  <option value="Rejuvenating Nature">Rejuvenating Nature</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isGeneratingSuggestions}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Gemini is curating places...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Generate Place Suggestions</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Generated Suggestions List */}
            {aiSuggestions.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Gemini Suggested Places ({aiSuggestions.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {aiSuggestions.map((sugg, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div>
                        <h5 className="font-semibold text-xs text-slate-900">{sugg.name}</h5>
                        <p className="text-[11px] text-slate-500">{sugg.address}</p>
                        <p className="mt-1 text-[11px] text-slate-700 italic">"{sugg.reason}"</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddAiSuggestion(sugg)}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 shadow-xs"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Track</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Maps API Key Configuration Modal */}
      {isApiKeyModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsApiKeyModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google Maps Platform Key
                  </h3>
                  <p className="text-xs text-slate-500">API Key configuration for interactive maps</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              {/* Active Key Status Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${isApiKeyValid && !mapAuthError ? 'bg-emerald-500' : mapAuthError ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <span>
                      {isUsingCustomKey
                        ? 'Custom Key Active'
                        : isUsingEnvKey
                        ? 'Environment Key Active'
                        : 'No Maps Key Configured'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isUsingCustomKey
                      ? 'Loaded from custom saved credentials.'
                      : isUsingEnvKey
                      ? 'Loaded from server/environment configuration.'
                      : 'Add your custom Google Maps API key below.'}
                  </p>
                </div>
                {isUsingCustomKey && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-rose-600 shadow-2xs"
                  >
                    Clear Custom
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-1.5 text-indigo-950">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Free Maps Demo Key for Prototyping</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-900">
                  For rapid testing with no billing setup required, obtain a free Google Maps Demo Key directly from:
                </p>
                <a
                  href="https://mapsplatform.google.com/maps-demo-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 underline hover:text-indigo-900"
                >
                  <span>https://mapsplatform.google.com/maps-demo-key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Enter Google Maps Platform API Key:
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-hidden"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Keys are stored securely in browser storage or can be configured via environment variable <code className="bg-slate-100 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code>.
                </p>
              </div>

              {/* Published App / Domain Authorization Notice */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Troubleshooting "Maps Auth Error" After Publishing</span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-1.5 leading-snug">
                  <p>
                    <strong>1. HTTP Referrers:</strong> If your key is restricted by website domain in Google Cloud Console, add this published URL pattern:
                  </p>
                  <div className="flex items-center gap-1">
                    <code className="bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-mono text-slate-800 truncate flex-1 select-all">
                      {recommendedDomainPattern}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(recommendedDomainPattern);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2000);
                        }
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      {copiedDomain ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="pt-1">
                    <strong>2. Required GCP APIs:</strong> Ensure <span className="text-slate-800 font-medium">Maps JavaScript API</span>, <span className="text-slate-800 font-medium">Places API (New)</span>, and <span className="text-slate-800 font-medium">Geocoding API</span> are enabled.
                  </p>
                  <a
                    href="https://console.cloud.google.com/google/maps-apis/credentials?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:underline pt-0.5"
                  >
                    <span>Manage Key in Google Cloud Console</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {keySaveSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-center text-xs font-semibold text-emerald-800 animate-fade-in">
                  ✓ API Key successfully updated!
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveApiKey()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
              >
                Apply Custom Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Place Add Modal */}
      <ManualAddPlaceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAddPlace={handleAddPlace}
        lists={lists}
        defaultListId={activeListId || undefined}
      />

      {/* Edit Place Modal */}
      <EditPlaceModal
        isOpen={Boolean(placeBeingEdited)}
        place={placeBeingEdited}
        onClose={() => setPlaceBeingEdited(null)}
        onSave={handleSavePlaceEdits}
        lists={lists}
      />

      {/* Manage Custom Place Lists Modal */}
      <ManageListsModal
        isOpen={isManageListsModalOpen}
        onClose={() => setIsManageListsModalOpen(false)}
        lists={lists}
        onCreateList={handleCreateList}
        onUpdateList={handleUpdateList}
        onDeleteList={handleDeleteList}
        onSelectList={(id) => setActiveListId(id)}
        activeListId={activeListId}
        placesCountByList={placesCountByList}
        totalPlacesCount={totalCount}
      />
    </div>
  );
};
