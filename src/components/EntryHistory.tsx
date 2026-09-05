import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Calendar,
  MessageSquare,
  Trash2,
  ArrowRight,
  Filter,
  Sparkles,
  Tag,
  MapPin,
  Globe2,
} from 'lucide-react';
import { JournalEntry, ReflectionMode } from '../types';

interface EntryHistoryProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onNewEntry: () => void;
  loading: boolean;
}

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  entries,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.location?.name && entry.location.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.location?.localizedName && entry.location.localizedName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.location?.notes && entry.location.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      entry.messages.some((m) =>
        m.content.toLowerCase().includes(searchTerm.toLowerCase())
      );

    let matchesMode = true;
    if (selectedMode === 'all') {
      matchesMode = true;
    } else if (selectedMode === 'geotagged') {
      matchesMode = !!entry.location;
    } else {
      matchesMode = entry.mode === selectedMode;
    }

    return matchesSearch && matchesMode;
  });

  const handleDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this reflection?')) {
      return;
    }
    setDeletingId(entryId);
    try {
      await onDeleteEntry(entryId);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Journal Reflection History
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            All conversations, pinned locations, and summaries are isolated in your Firestore account.
          </p>
        </div>
        <button
          id="new-reflection-btn"
          onClick={onNewEntry}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="search-history-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search entries by title, pinned location, insight, or keyword..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none shadow-2xs"
          />
        </div>

        {/* Mode Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            id="filter-all-btn"
            onClick={() => setSelectedMode('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              selectedMode === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All ({entries.length})
          </button>
          <button
            id="filter-geotagged-btn"
            onClick={() => setSelectedMode('geotagged')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              selectedMode === 'geotagged'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MapPin className="h-3 w-3" />
            <span>Pinned Places</span>
          </button>
          <button
            id="filter-reflection-btn"
            onClick={() => setSelectedMode('reflection')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              selectedMode === 'reflection'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Reflections
          </button>
          <button
            id="filter-summary-btn"
            onClick={() => setSelectedMode('summary')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              selectedMode === 'summary'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Summaries
          </button>
          <button
            id="filter-brainstorming-btn"
            onClick={() => setSelectedMode('brainstorming')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              selectedMode === 'brainstorming'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Brainstorms
          </button>
        </div>
      </div>

      {/* Entry List */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/70"
              />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {entries.length === 0 ? 'No reflections saved yet' : 'No matching entries found'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {entries.length === 0
                ? 'Write your first thoughts to start building your private AI reflection archive.'
                : 'Try adjusting your search keywords or filter selection.'}
            </p>
            {entries.length === 0 && (
              <button
                id="create-first-reflection-btn"
                onClick={onNewEntry}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Create Your First Reflection</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {filteredEntries.map((entry) => {
              const lastUserMessage = [...entry.messages]
                .reverse()
                .find((m) => m.role === 'user')?.content;
              const lastModelResponse = [...entry.messages]
                .reverse()
                .find((m) => m.role === 'model')?.content;

              const dateStr = new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(
                undefined,
                {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }
              );

              return (
                <div
                  key={entry.id}
                  id={`entry-card-${entry.id}`}
                  onClick={() => onSelectEntry(entry)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
                >
                  <div>
                    {/* Tags row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                          {entry.mode}
                        </span>
                        {entry.mood && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-100">
                            {entry.mood}
                          </span>
                        )}
                        {entry.location && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                            <MapPin className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[120px]">
                              {entry.location.localizedName || entry.location.name}
                            </span>
                          </span>
                        )}
                      </div>

                      <button
                        id={`delete-entry-${entry.id}`}
                        onClick={(e) => handleDelete(e, entry.id)}
                        disabled={deletingId === entry.id}
                        className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                        title="Delete Reflection"
                      >
                        {deletingId === entry.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {entry.title || 'Untitled Reflection'}
                    </h3>

                    {/* Location preview banner if present */}
                    {entry.location && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0 text-indigo-500" />
                        <span className="font-medium text-slate-700 truncate">
                          {entry.location.localizedName || entry.location.name}
                        </span>
                        {entry.location.originalName && entry.location.originalName !== entry.location.name && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.2 text-[9px] text-amber-800 border border-amber-200 shrink-0">
                            <Globe2 className="h-2 w-2" />
                            <span>{entry.location.originalName}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Snippet */}
                    <p className="mt-1.5 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                      {lastUserMessage || lastModelResponse || 'No message content.'}
                    </p>
                  </div>

                  {/* Footer Meta */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{dateStr}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{entry.messages.length} messages</span>
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Continue</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

