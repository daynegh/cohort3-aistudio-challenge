import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Loader2,
  Save,
  Compass,
  Star,
  CheckCircle2,
  Bookmark,
  Coffee,
  Palette,
  Landmark,
  Hotel,
  Activity,
  Layers,
  Sparkles,
  Languages,
  FolderHeart,
} from 'lucide-react';
import { LocationCoordinatePicker } from './LocationCoordinatePicker';
import { PlaceCategory, PlaceVisitStatus, PlaceOfInterest, PlaceList } from '../types';
import { requestLocationLocalization } from '../services/geminiService';

export interface EditPlaceModalProps {
  isOpen: boolean;
  place: PlaceOfInterest | null;
  onClose: () => void;
  onSave: (
    placeId: string,
    updates: Partial<Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt'>>
  ) => Promise<void>;
  lists?: PlaceList[];
}

export const EditPlaceModal: React.FC<EditPlaceModalProps> = ({
  isOpen,
  place,
  onClose,
  onSave,
  lists = [],
}) => {
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [address, setAddress] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('nature_parks');
  const [status, setStatus] = useState<PlaceVisitStatus>('want_to_visit');
  const [listId, setListId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalizing, setIsLocalizing] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);

  // Sync form state whenever selected place changes or modal opens
  useEffect(() => {
    if (place) {
      setName(place.localizedName || place.name || '');
      setOriginalName(place.originalName || '');
      setAddress(place.localizedAddress || place.address || '');
      setOriginalAddress(place.originalAddress || '');
      setLat(place.lat !== undefined ? String(place.lat) : '');
      setLng(place.lng !== undefined ? String(place.lng) : '');
      setCategory(place.category || 'nature_parks');
      setStatus(place.status || 'want_to_visit');
      setListId(place.listId || (place.listIds && place.listIds[0]) || '');
      setNotes(place.notes || '');
      setRating(place.rating !== undefined ? String(place.rating) : '');
      setCoordError(null);
    }
  }, [place, isOpen]);

  if (!isOpen || !place) return null;

  const handleAutoLocalize = async () => {
    if (!name.trim() && !address.trim()) return;
    setIsLocalizing(true);
    try {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const res = await requestLocationLocalization({
        name: name.trim() || originalName.trim(),
        address: address.trim() || originalAddress.trim(),
        lat: isNaN(latNum) ? undefined : latNum,
        lng: isNaN(lngNum) ? undefined : lngNum,
      });

      if (res && res.hasLocalization) {
        if (res.originalName && !originalName.trim()) {
          setOriginalName(res.originalName);
        }
        if (res.originalAddress && !originalAddress.trim()) {
          setOriginalAddress(res.originalAddress);
        }
        if (res.localizedName) {
          setName(res.localizedName);
        }
        if (res.localizedAddress) {
          setAddress(res.localizedAddress);
        }
      }
    } catch (err) {
      console.warn('Auto localization error in EditPlaceModal:', err);
    } finally {
      setIsLocalizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (
      isNaN(latNum) ||
      isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      setCoordError(
        'Please enter valid coordinates: Latitude between -90 and 90, Longitude between -180 and 180.'
      );
      return;
    }

    let parsedRating: number | undefined = undefined;
    if (rating.trim()) {
      const r = parseFloat(rating);
      if (!isNaN(r) && r >= 0 && r <= 5) {
        parsedRating = Math.round(r * 10) / 10;
      }
    }

    setCoordError(null);
    setIsSubmitting(true);
    try {
      const primaryName = name.trim();
      const primaryAddress = address.trim() || `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;

      await onSave(place.id, {
        name: primaryName,
        localizedName: primaryName,
        originalName: originalName.trim() || undefined,
        address: primaryAddress,
        localizedAddress: primaryAddress,
        originalAddress: originalAddress.trim() || undefined,
        lat: latNum,
        lng: lngNum,
        category,
        status,
        listId: listId || undefined,
        listIds: listId ? [listId] : [],
        notes: notes.trim(),
        rating: parsedRating,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update place:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (cat: PlaceCategory) => {
    switch (cat) {
      case 'nature_parks':
        return <Compass className="h-4 w-4 text-emerald-600" />;
      case 'cafes_food':
        return <Coffee className="h-4 w-4 text-amber-600" />;
      case 'arts_culture':
        return <Palette className="h-4 w-4 text-purple-600" />;
      case 'historical':
        return <Landmark className="h-4 w-4 text-blue-600" />;
      case 'travel_lodging':
        return <Hotel className="h-4 w-4 text-indigo-600" />;
      case 'activities':
        return <Activity className="h-4 w-4 text-teal-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100/80">
              {getCategoryIcon(category)}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Location</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                Update English localization, original text, coordinates, or details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {coordError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {coordError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Place Name (English) & Localize Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Place Name (English) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoLocalize}
                disabled={isLocalizing || (!name.trim() && !address.trim() && !originalName.trim())}
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors"
                title="Translate location to English while extracting or preserving original local text"
              >
                {isLocalizing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Languages className="h-3 w-3" />
                )}
                <span>Localize with Gemini</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tokyo Tower (in English)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Original Name / Native Script */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Original Name / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={originalName}
              onChange={(e) => setOriginalName(e.target.value)}
              placeholder="e.g. 東京タワー"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Formatted Address / Region (English) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Formatted Address or City (English)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 4-2-8 Shibakoen, Minato City, Tokyo"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Original Address / Local Script */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Original Address / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={originalAddress}
              onChange={(e) => setOriginalAddress(e.target.value)}
              placeholder="e.g. 東京都港区芝公園４丁目２−８"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Coordinates (Lat / Lng) with interactive Pin Location on Map */}
          <LocationCoordinatePicker
            lat={lat}
            lng={lng}
            onChangeCoordinates={(newLat, newLng) => {
              setLat(String(newLat));
              setLng(String(newLng));
            }}
            onAddressDetected={(detectedAddr) => {
              if (!address.trim()) {
                setAddress(detectedAddr);
              }
            }}
            onLocationDetailsDetected={(details) => {
              if (!name.trim()) {
                setName(details.localizedName);
              }
              if (!originalName.trim() && details.originalName && details.originalName !== details.localizedName) {
                setOriginalName(details.originalName);
              }
              if (!address.trim()) {
                setAddress(details.localizedAddress);
              }
              if (!originalAddress.trim() && details.originalAddress && details.originalAddress !== details.localizedAddress) {
                setOriginalAddress(details.originalAddress);
              }
            }}
          />

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700">Rating (Optional)</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="e.g. 4.8"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
                <Star className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500 fill-amber-400" />
              </div>
            </div>
          </div>

          {/* Visit Status Selection Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Visit Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('want_to_visit')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-all ${
                  status === 'want_to_visit'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Want to Visit</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('visited')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-all ${
                  status === 'visited'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Visited</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('favorite')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-all ${
                  status === 'favorite'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span>Favorite</span>
              </button>
            </div>
          </div>

          {/* Custom List Assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom List / Collection
            </label>
            <select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">General / All Places (No specific list)</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Personal Notes & Reflections */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Personal Notes / Why you want to visit
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your thoughts, what to order, best time to visit, or memories..."
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
