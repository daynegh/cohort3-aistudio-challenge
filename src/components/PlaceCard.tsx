import React, { useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  Bookmark,
  Star,
  ExternalLink,
  Trash2,
  Edit3,
  Check,
  X,
  Compass,
  Coffee,
  Palette,
  Landmark,
  Hotel,
  Activity,
  Layers,
  Languages,
  FolderHeart,
} from 'lucide-react';
import { PlaceOfInterest, PlaceVisitStatus, PlaceCategory, PlaceList } from '../types';
import { getListColorClasses, getListIconComponent } from './ManageListsModal';

interface PlaceCardProps {
  place: PlaceOfInterest;
  isSelected: boolean;
  onSelect: (place: PlaceOfInterest) => void;
  onUpdateStatus: (placeId: string, status: PlaceVisitStatus) => Promise<void>;
  onUpdateNotes: (placeId: string, notes: string) => Promise<void>;
  onDelete: (placeId: string) => Promise<void>;
  onEdit?: (place: PlaceOfInterest) => void;
  lists?: PlaceList[];
  onQuickAssignList?: (placeId: string, listId: string | undefined) => Promise<void>;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  isSelected,
  onSelect,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
  onEdit,
  lists = [],
  onQuickAssignList,
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(place.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingList, setIsChangingList] = useState(false);

  const displayName = place.localizedName || place.name;
  const originalName = place.originalName;
  const hasOriginalName = originalName && originalName !== displayName;

  const displayAddress = place.localizedAddress || place.address;
  const originalAddress = place.originalAddress;
  const hasOriginalAddress = originalAddress && originalAddress !== displayAddress;

  // Find assigned list
  const activePlaceListId = place.listId || (place.listIds && place.listIds[0]);
  const assignedList = lists.find((l) => l.id === activePlaceListId);

  const getCategoryIcon = (cat: PlaceCategory) => {
    switch (cat) {
      case 'nature_parks':
        return <Compass className="h-3.5 w-3.5 text-emerald-600" />;
      case 'cafes_food':
        return <Coffee className="h-3.5 w-3.5 text-amber-600" />;
      case 'arts_culture':
        return <Palette className="h-3.5 w-3.5 text-purple-600" />;
      case 'historical':
        return <Landmark className="h-3.5 w-3.5 text-blue-600" />;
      case 'travel_lodging':
        return <Hotel className="h-3.5 w-3.5 text-indigo-600" />;
      case 'activities':
        return <Activity className="h-3.5 w-3.5 text-teal-600" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-slate-600" />;
    }
  };

  const getCategoryLabel = (cat: PlaceCategory) => {
    switch (cat) {
      case 'nature_parks':
        return 'Nature & Parks';
      case 'cafes_food':
        return 'Cafes & Dining';
      case 'arts_culture':
        return 'Arts & Culture';
      case 'historical':
        return 'Historical';
      case 'travel_lodging':
        return 'Lodging';
      case 'activities':
        return 'Activities';
      default:
        return 'Point of Interest';
    }
  };

  const handleSaveNotes = async () => {
    setIsUpdating(true);
    try {
      await onUpdateNotes(place.id, draftNotes.trim());
      setIsEditingNotes(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const cycleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: Record<PlaceVisitStatus, PlaceVisitStatus> = {
      want_to_visit: 'visited',
      visited: 'favorite',
      favorite: 'want_to_visit',
    };
    await onUpdateStatus(place.id, nextStatus[place.status]);
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.address}`
  )}`;

  return (
    <div
      onClick={() => onSelect(place)}
      className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
            {getCategoryIcon(place.category)}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h4 className="font-semibold text-slate-900 text-sm leading-snug">{displayName}</h4>
              {hasOriginalName && (
                <span
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium border border-slate-200"
                  title={`Original native text: ${originalName}`}
                >
                  <Languages className="h-2.5 w-2.5 text-slate-400" />
                  {originalName}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-medium text-slate-500">
                {getCategoryLabel(place.category)}
              </span>
              {place.rating && (
                <span className="text-[11px] font-semibold text-amber-600">
                  ★ {place.rating.toFixed(1)}
                </span>
              )}
              {assignedList && (() => {
                const IconComp = getListIconComponent(assignedList.icon);
                const colorInfo = getListColorClasses(assignedList.color);
                return (
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-semibold border ${colorInfo.pill}`}>
                    <IconComp className="h-2.5 w-2.5" />
                    <span>{assignedList.name}</span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Status Chip */}
        <button
          onClick={cycleStatus}
          title="Click to cycle status: Want to Visit → Visited → Favorite"
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border flex items-center gap-1 transition-colors ${
            place.status === 'want_to_visit'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : place.status === 'visited'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {place.status === 'want_to_visit' && <Bookmark className="h-3 w-3" />}
          {place.status === 'visited' && <CheckCircle2 className="h-3 w-3" />}
          {place.status === 'favorite' && <Star className="h-3 w-3 fill-amber-500" />}
          <span className="capitalize">
            {place.status === 'want_to_visit' ? 'Want to Visit' : place.status}
          </span>
        </button>
      </div>

      {/* Address */}
      <div className="mt-2.5 space-y-0.5">
        <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{displayAddress}</span>
        </p>
        {hasOriginalAddress && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400 italic truncate pl-5">
            <span className="text-[9px] uppercase font-semibold text-slate-400 not-italic tracking-wider">Orig:</span>
            <span className="truncate">{originalAddress}</span>
          </p>
        )}
      </div>

      {/* Personal Notes */}
      {isEditingNotes ? (
        <div className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            rows={2}
            placeholder="Add reflection or notes about visiting..."
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsEditingNotes(false)}
              className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              disabled={isUpdating}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
          </div>
        </div>
      ) : place.notes ? (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 border border-slate-100">
          <p className="line-clamp-2 italic">"{place.notes}"</p>
        </div>
      ) : null}

      {/* Card Actions Bar */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onEdit) {
                onEdit(place);
              } else {
                setIsEditingNotes(!isEditingNotes);
              }
            }}
            className="flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            title="Edit location details, coordinates, status or notes"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          {lists.length > 0 && onQuickAssignList && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <select
                value={activePlaceListId || ''}
                onChange={async (e) => {
                  const targetList = e.target.value || undefined;
                  await onQuickAssignList(place.id, targetList);
                }}
                className="rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-slate-300 focus:outline-hidden"
                title="Move to another list"
              >
                <option value="">General</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingNotes(!isEditingNotes);
            }}
            className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
            title="Quick toggle inline notes"
          >
            {place.notes ? 'Notes' : '+Note'}
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Open in Google Maps for directions"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Directions</span>
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove "${place.name}" from your places list?`)) {
                onDelete(place.id);
              }
            }}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
            title="Delete place"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
