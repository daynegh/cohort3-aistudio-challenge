import React, { useState } from 'react';
import { Plus, X, MapPin, Loader2, Compass, Languages, FolderHeart } from 'lucide-react';
import { PlaceCategory, PlaceVisitStatus, PlaceOfInterest, PlaceList } from '../types';
import { LocationCoordinatePicker } from './LocationCoordinatePicker';
import { requestLocationLocalization } from '../services/geminiService';

interface ManualAddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlace: (place: Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  lists?: PlaceList[];
  defaultListId?: string | null;
}

export const ManualAddPlaceModal: React.FC<ManualAddPlaceModalProps> = ({
  isOpen,
  onClose,
  onAddPlace,
  lists = [],
  defaultListId,
}) => {
  const [customName, setCustomName] = useState('');
  const [customOriginalName, setCustomOriginalName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [customOriginalAddress, setCustomOriginalAddress] = useState('');
  const [customLat, setCustomLat] = useState('37.7749');
  const [customLng, setCustomLng] = useState('-122.4194');
  const [category, setCategory] = useState<PlaceCategory>('nature_parks');
  const [status, setStatus] = useState<PlaceVisitStatus>('want_to_visit');
  const [selectedListId, setSelectedListId] = useState<string>(defaultListId || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalizing, setIsLocalizing] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);

  // Sync default list if prop changes
  React.useEffect(() => {
    if (defaultListId) {
      setSelectedListId(defaultListId);
    }
  }, [defaultListId]);

  if (!isOpen) return null;

  const handleAutoLocalize = async () => {
    if (!customName.trim() && !customAddress.trim() && !customOriginalName.trim()) return;
    setIsLocalizing(true);
    try {
      const latNum = parseFloat(customLat);
      const lngNum = parseFloat(customLng);
      const res = await requestLocationLocalization({
        name: customName.trim() || customOriginalName.trim(),
        address: customAddress.trim() || customOriginalAddress.trim(),
        lat: isNaN(latNum) ? undefined : latNum,
        lng: isNaN(lngNum) ? undefined : lngNum,
      });

      if (res && res.hasLocalization) {
        if (res.originalName && !customOriginalName.trim()) {
          setCustomOriginalName(res.originalName);
        }
        if (res.originalAddress && !customOriginalAddress.trim()) {
          setCustomOriginalAddress(res.originalAddress);
        }
        if (res.localizedName) {
          setCustomName(res.localizedName);
        }
        if (res.localizedAddress) {
          setCustomAddress(res.localizedAddress);
        }
      }
    } catch (err) {
      console.warn('Auto localization error in ManualAddPlaceModal:', err);
    } finally {
      setIsLocalizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const latNum = parseFloat(customLat);
    const lngNum = parseFloat(customLng);

    if (
      isNaN(latNum) ||
      isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      setCoordError(
        'Please provide valid geographical coordinates: Latitude must be between -90 and 90, Longitude between -180 and 180.'
      );
      return;
    }

    setCoordError(null);
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
        listId: selectedListId || undefined,
        listIds: selectedListId ? [selectedListId] : undefined,
        notes: notes.trim(),
      });
      // Reset form
      setCustomName('');
      setCustomOriginalName('');
      setCustomAddress('');
      setCustomOriginalAddress('');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Failed to save manual place:', err);
    } finally {
      setIsSubmitting(false);
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
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Place Manually</h3>
              <p className="text-xs text-slate-500">Record a custom location in English with native script preserved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {coordError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {coordError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Location Name (English) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoLocalize}
                disabled={isLocalizing || (!customName.trim() && !customAddress.trim() && !customOriginalName.trim())}
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors"
                title="Translate to English while preserving original local text"
              >
                {isLocalizing ? (
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
              placeholder="e.g. Tokyo Tower"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Original Name / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={customOriginalName}
              onChange={(e) => setCustomOriginalName(e.target.value)}
              placeholder="e.g. 東京タワー"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Formatted Address or Region (English)
            </label>
            <input
              type="text"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              placeholder="e.g. 4-2-8 Shibakoen, Minato City, Tokyo"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Original Address / Local Script <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={customOriginalAddress}
              onChange={(e) => setCustomOriginalAddress(e.target.value)}
              placeholder="e.g. 東京都港区芝公園４丁目２−８"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Coordinates with Pin Location on Map */}
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
              if (!customAddress.trim()) {
                setCustomAddress(details.localizedAddress);
              }
              if (!customOriginalAddress.trim() && details.originalAddress && details.originalAddress !== details.localizedAddress) {
                setCustomOriginalAddress(details.originalAddress);
              }
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Add to List</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">General / All Places</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
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
              <label className="block text-xs font-semibold text-slate-700">Status</label>
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
            <label className="block text-xs font-semibold text-slate-700">Personal Notes / Why Visit</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this location inspires you or what to reflect on when visiting..."
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Place to Firestore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
