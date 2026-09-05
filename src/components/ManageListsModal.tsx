import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  FolderHeart,
  Check,
  Sparkles,
  MapPin,
  Heart,
  Coffee,
  Camera,
  Compass,
  Landmark,
  Utensils,
  Sun,
  Layers,
  Bookmark,
} from 'lucide-react';
import { PlaceList } from '../types';

export interface ManageListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: PlaceList[];
  activeListId: string | null;
  onSelectList: (listId: string | null) => void;
  onCreateList: (list: Omit<PlaceList, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateList: (listId: string, updates: Partial<Omit<PlaceList, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  placesCountByList: Record<string, number>;
  totalPlacesCount: number;
}

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', lightBg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', ring: 'ring-indigo-500', pill: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', ring: 'ring-emerald-500', pill: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', lightBg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', ring: 'ring-amber-500', pill: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', lightBg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', ring: 'ring-rose-500', pill: 'bg-rose-50 border-rose-200 text-rose-700' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500', lightBg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', ring: 'ring-sky-500', pill: 'bg-sky-50 border-sky-200 text-sky-700' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500', lightBg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', ring: 'ring-violet-500', pill: 'bg-violet-50 border-violet-200 text-violet-700' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500', lightBg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700', ring: 'ring-teal-500', pill: 'bg-teal-50 border-teal-200 text-teal-700' },
  { id: 'fuchsia', label: 'Fuchsia', bg: 'bg-fuchsia-500', lightBg: 'bg-fuchsia-50', border: 'border-fuchsia-300', text: 'text-fuchsia-700', ring: 'ring-fuchsia-500', pill: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' },
];

const ICON_OPTIONS = [
  { id: 'Heart', label: 'Heart', Icon: Heart },
  { id: 'Coffee', label: 'Coffee', Icon: Coffee },
  { id: 'Camera', label: 'Camera', Icon: Camera },
  { id: 'Compass', label: 'Compass', Icon: Compass },
  { id: 'Landmark', label: 'Landmark', Icon: Landmark },
  { id: 'Utensils', label: 'Food', Icon: Utensils },
  { id: 'Sun', label: 'Vacation', Icon: Sun },
  { id: 'Bookmark', label: 'Bookmark', Icon: Bookmark },
  { id: 'MapPin', label: 'Pin', Icon: MapPin },
];

export const getListIconComponent = (iconName?: string) => {
  switch (iconName) {
    case 'Heart': return Heart;
    case 'Coffee': return Coffee;
    case 'Camera': return Camera;
    case 'Compass': return Compass;
    case 'Landmark': return Landmark;
    case 'Utensils': return Utensils;
    case 'Sun': return Sun;
    case 'Bookmark': return Bookmark;
    default: return MapPin;
  }
};

export const getListColorClasses = (colorName?: string) => {
  const match = COLOR_OPTIONS.find((c) => c.id === colorName);
  return match || COLOR_OPTIONS[0];
};

export const ManageListsModal: React.FC<ManageListsModalProps> = ({
  isOpen,
  onClose,
  lists,
  activeListId,
  onSelectList,
  onCreateList,
  onUpdateList,
  onDeleteList,
  placesCountByList,
  totalPlacesCount,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('indigo');
  const [icon, setIcon] = useState('Bookmark');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingListId(null);
    setName('');
    setDescription('');
    setColor('indigo');
    setIcon('Bookmark');
  };

  const handleStartEdit = (list: PlaceList) => {
    setEditingListId(list.id);
    setIsCreating(false);
    setName(list.name);
    setDescription(list.description || '');
    setColor(list.color || 'indigo');
    setIcon(list.icon || 'Bookmark');
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingListId(null);
    setName('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingListId) {
        await onUpdateList(editingListId, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
        });
        setEditingListId(null);
      } else {
        await onCreateList({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
        });
        setIsCreating(false);
      }
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Failed to save list:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (listId: string) => {
    try {
      await onDeleteList(listId);
      if (activeListId === listId) {
        onSelectList(null);
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FolderHeart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Custom Lists & Itineraries
              </h3>
              <p className="text-xs text-slate-500">
                Organize your places into thematic collections, trips, and bucket lists
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Create or Edit Form */}
          {(isCreating || editingListId) ? (
            <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{editingListId ? 'Edit List Details' : 'Create New Places List'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  List Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Tokyo Coffee Tour, Kyoto Temples, Weekend Getaways"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Handpicked cafes and roasters in Shibuya & Daikanyama"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Theme Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`h-7 w-7 rounded-full ${c.bg} flex items-center justify-center text-white transition-transform ${
                        color === c.id ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105 opacity-85'
                      }`}
                      title={c.label}
                    >
                      {color === c.id && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                  {ICON_OPTIONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIcon(id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs transition-all ${
                        icon === id
                          ? 'border-indigo-500 bg-white text-indigo-600 shadow-xs font-semibold'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                      }`}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingListId ? 'Update List' : 'Create List'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Active Collections ({lists.length + 1})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New List</span>
              </button>
            </div>
          )}

          {/* List of collections */}
          <div className="space-y-2">
            {/* All Places row */}
            <div
              className={`rounded-xl border p-3 flex items-center justify-between transition-all ${
                activeListId === null
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div
                onClick={() => {
                  onSelectList(null);
                  onClose();
                }}
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">All Places</span>
                    {activeListId === null && (
                      <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Active View
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Complete collection across all categories & trips
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {totalPlacesCount} places
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSelectList(null);
                    onClose();
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  View
                </button>
              </div>
            </div>

            {/* Custom User Lists */}
            {lists.map((list) => {
              const IconComponent = getListIconComponent(list.icon);
              const colorInfo = getListColorClasses(list.color);
              const count = placesCountByList[list.id] || 0;
              const isSelected = activeListId === list.id;

              return (
                <div
                  key={list.id}
                  className={`rounded-xl border p-3 flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    onClick={() => {
                      onSelectList(list.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorInfo.pill}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {list.name}
                        </span>
                        {isSelected && (
                          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            Active View
                          </span>
                        )}
                      </div>
                      {list.description && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {list.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${colorInfo.pill}`}>
                      {count} {count === 1 ? 'place' : 'places'}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(list)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="Edit list name and style"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete button with confirmation */}
                    {deleteConfirmId === list.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(list.id)}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white shadow-2xs hover:bg-rose-700"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(list.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete list"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Lists sync automatically across devices.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
