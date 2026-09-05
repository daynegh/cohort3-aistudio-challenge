import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Sparkles,
  Send,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Brain,
  ListOrdered,
  Lightbulb,
  MessageSquare,
  Copy,
  Check,
  PlusCircle,
  HelpCircle,
  MapPin,
  Globe2,
  ExternalLink,
  Trash2,
  Edit3,
  BookmarkCheck,
  Navigation,
} from 'lucide-react';
import { JournalEntry, JournalMessage, PinnedJournalLocation, ReflectionMode } from '../types';
import { requestGeminiReflection } from '../services/geminiService';
import { saveJournalEntry } from '../services/journalService';
import { savePlaceOfInterest } from '../services/placesService';
import { PinLocationModal } from './PinLocationModal';

interface JournalEditorProps {
  user: User;
  currentEntry: JournalEntry | null;
  onEntrySaved: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onNavigateToPlaces?: (placeId?: string, coordinates?: { lat: number; lng: number }) => void;
}

const MODES: { id: ReflectionMode; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
  {
    id: 'reflection',
    label: 'Deep Reflection',
    icon: MessageSquare,
    desc: 'Empathetic coaching and philosophical exploration of your thoughts.',
  },
  {
    id: 'summary',
    label: 'Executive Summary',
    icon: ListOrdered,
    desc: 'Synthesize key patterns, emotional themes, and central takeaways.',
  },
  {
    id: 'brainstorming',
    label: 'Brainstorming',
    icon: Lightbulb,
    desc: 'Generate creative solutions, fresh angles, and novel perspectives.',
  },
  {
    id: 'action_plan',
    label: 'Action Plan',
    icon: Brain,
    desc: 'Extract 3-5 concrete, actionable steps to turn insight into progress.',
  },
];

const MOODS = ['Thoughtful', 'Calm', 'Energized', 'Grateful', 'Stressed', 'Determined'];

const PROMPT_SUGGESTIONS = [
  'What decision has been occupying your mind today?',
  'Reflect on a recent win or unexpected moment of gratitude.',
  'What is an assumption you made recently that might be incorrect?',
  'What would today look like if it were effortless?',
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  user,
  currentEntry,
  onEntrySaved,
  onNewEntry,
  onNavigateToPlaces,
}) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<ReflectionMode>('reflection');
  const [mood, setMood] = useState<string>('Thoughtful');
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Pinned Location State
  const [pinnedLocation, setPinnedLocation] = useState<PinnedJournalLocation | null>(
    currentEntry?.location || null
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [savedToPlacesNotice, setSavedToPlacesNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeEntryId = useRef<string>(currentEntry?.id || `entry_${Date.now()}`);

  // Sync state when currentEntry changes
  useEffect(() => {
    if (currentEntry) {
      activeEntryId.current = currentEntry.id;
      setTitle(currentEntry.title || '');
      setMode(currentEntry.mode || 'reflection');
      setMood(currentEntry.mood || 'Thoughtful');
      setMessages(currentEntry.messages || []);
      setPinnedLocation(currentEntry.location || null);
      setSaveStatus('saved');
    } else {
      activeEntryId.current = `entry_${Date.now()}`;
      setTitle('');
      setMode('reflection');
      setMood('Thoughtful');
      setMessages([]);
      setPinnedLocation(null);
      setSaveStatus('idle');
    }
  }, [currentEntry]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (customPrompt?: string, customMode?: ReflectionMode) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || loading) return;

    const chosenMode = customMode || mode;
    setLoading(true);
    setErrorMessage(null);
    setSaveStatus('saving');

    const userMessage: JournalMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!customPrompt) {
      setInputText('');
    }

    // Auto-derive title if blank
    const entryTitle =
      title.trim() ||
      textToSend.slice(0, 42) + (textToSend.length > 42 ? '...' : '');
    if (!title.trim()) {
      setTitle(entryTitle);
    }

    try {
      // 1. Call Gemini with resilient fallback ladder and optional geographical context
      const promptWithGeoContext = pinnedLocation
        ? `${textToSend}\n\n[Location Context: User is reflecting at ${pinnedLocation.localizedName || pinnedLocation.name}${
            pinnedLocation.notes ? ` - Note: "${pinnedLocation.notes}"` : ''
          }]`
        : textToSend;

      const geminiResponse = await requestGeminiReflection({
        prompt: promptWithGeoContext,
        mode: chosenMode,
        history: messages,
        title: entryTitle,
      });

      const modelMessage: JournalMessage = {
        id: `msg_${Date.now()}_model`,
        role: 'model',
        content: geminiResponse.text,
        timestamp: new Date().toISOString(),
        modelUsed: geminiResponse.modelUsed,
      };

      const finalMessages = [...newMessages, modelMessage];
      setMessages(finalMessages);

      // 2. Persist to Firestore with strict user isolation and pinned location
      const entryToSave: JournalEntry = {
        id: activeEntryId.current,
        userId: user.uid,
        title: entryTitle,
        mode: chosenMode,
        mood,
        messages: finalMessages,
        location: pinnedLocation,
        summary:
          chosenMode === 'summary'
            ? geminiResponse.text
            : currentEntry?.summary || '',
        createdAt: currentEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [
          chosenMode,
          mood.toLowerCase(),
          ...(pinnedLocation ? ['geotagged', (pinnedLocation.localizedName || pinnedLocation.name).toLowerCase()] : []),
        ],
      };

      await saveJournalEntry(user.uid, entryToSave);
      setSaveStatus('saved');
      onEntrySaved(entryToSave);
    } catch (err: any) {
      console.error('Error during reflection generation or save:', err);
      setErrorMessage(
        err?.message || 'An unexpected error occurred while communicating with Gemini or Firestore.'
      );
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (messages.length === 0 && !pinnedLocation && !title.trim()) return;
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const entryToSave: JournalEntry = {
        id: activeEntryId.current,
        userId: user.uid,
        title: title.trim() || 'Untitled Reflection',
        mode,
        mood,
        messages,
        location: pinnedLocation,
        createdAt: currentEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [
          mode,
          mood.toLowerCase(),
          ...(pinnedLocation ? ['geotagged'] : []),
        ],
      };
      await saveJournalEntry(user.uid, entryToSave);
      setSaveStatus('saved');
      onEntrySaved(entryToSave);
    } catch (err: any) {
      console.error('Manual save failed:', err);
      setErrorMessage('Failed to save to Firestore. Please retry.');
      setSaveStatus('error');
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Add pinned location to Places of Interest
  const handleSaveToMyPlaces = async () => {
    if (!pinnedLocation || !user) return;
    try {
      await savePlaceOfInterest(user.uid, {
        id: `place_${Date.now()}`,
        userId: user.uid,
        name: pinnedLocation.name,
        originalName: pinnedLocation.originalName,
        localizedName: pinnedLocation.localizedName,
        address: pinnedLocation.address,
        originalAddress: pinnedLocation.originalAddress,
        localizedAddress: pinnedLocation.localizedAddress,
        lat: pinnedLocation.lat,
        lng: pinnedLocation.lng,
        placeId: pinnedLocation.placeId,
        category: pinnedLocation.category || 'other',
        status: 'favorite',
        notes: pinnedLocation.notes || `Linked to reflection: "${title || 'Journal Entry'}"`,
        linkedEntryId: activeEntryId.current,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSavedToPlacesNotice(true);
      setTimeout(() => setSavedToPlacesNotice(false), 3000);
    } catch (err) {
      console.error('Failed to save pinned location to Places Tracker:', err);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!pinnedLocation) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${pinnedLocation.lat},${pinnedLocation.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Controls Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              id="entry-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reflection Title (e.g., Designing clarity for tomorrow)..."
              className="w-full text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 border-b border-transparent focus:border-indigo-500 pb-1 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Save indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Synced to Firestore</span>
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-slate-500">
                  <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                  <span>Saving...</span>
                </span>
              )}
              {saveStatus === 'error' && (
                <button
                  id="retry-save-btn"
                  onClick={handleManualSave}
                  className="flex items-center gap-1 font-medium text-rose-600 hover:underline"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Retry Save</span>
                </button>
              )}
            </div>

            {/* Pin Location Button in Top Bar */}
            <button
              id="top-bar-pin-location-btn"
              onClick={() => setIsPinModalOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                pinnedLocation
                  ? 'border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              <span>{pinnedLocation ? 'Location Attached' : 'Pin Location'}</span>
            </button>

            <button
              id="manual-save-btn"
              onClick={handleManualSave}
              disabled={(messages.length === 0 && !pinnedLocation) || saveStatus === 'saving'}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save</span>
            </button>

            <button
              id="new-entry-btn"
              onClick={onNewEntry}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Entry</span>
            </button>
          </div>
        </div>

        {/* Mode Selector & Mood Chips */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">AI Mode:</span>
            {MODES.map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  id={`mode-select-${m.id}`}
                  onClick={() => setMode(m.id)}
                  title={m.desc}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">Mood:</span>
            {MOODS.map((m) => (
              <button
                key={m}
                id={`mood-select-${m.toLowerCase()}`}
                onClick={() => setMood(m)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                  mood === m
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PINNED LOCATION ATTACHMENT CARD */}
      {pinnedLocation && (
        <div
          id="pinned-location-card"
          className="mt-4 rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 shadow-xs transition-all animate-in fade-in"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                    Pinned Location
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {pinnedLocation.localizedName || pinnedLocation.name}
                  </h4>
                  {pinnedLocation.originalName &&
                    pinnedLocation.originalName !== pinnedLocation.name && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-200">
                        <Globe2 className="h-2.5 w-2.5" />
                        <span>Native: {pinnedLocation.originalName}</span>
                      </span>
                    )}
                </div>

                <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                  {pinnedLocation.localizedAddress || pinnedLocation.address}
                </p>

                {pinnedLocation.notes && (
                  <p className="text-xs text-indigo-900/90 font-medium italic mt-1 bg-white/80 border border-indigo-100 rounded-lg px-2.5 py-1">
                    "{pinnedLocation.notes}"
                  </p>
                )}

                <p className="text-[10px] font-mono text-slate-400 mt-1">
                  Coordinates: {pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Quick Actions on Pinned Location */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap self-end sm:self-center">
              {onNavigateToPlaces ? (
                <button
                  id="view-on-places-tracker-btn"
                  onClick={() =>
                    onNavigateToPlaces(pinnedLocation.placeId, {
                      lat: pinnedLocation.lat,
                      lng: pinnedLocation.lng,
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs"
                  title="Center and view on interactive Places map"
                >
                  <Navigation className="h-3 w-3 text-indigo-600" />
                  <span>View on Map</span>
                </button>
              ) : (
                <button
                  id="open-google-maps-btn"
                  onClick={handleOpenGoogleMaps}
                  className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs"
                  title="Open location coordinates in Google Maps"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Google Maps</span>
                </button>
              )}

              <button
                id="save-to-places-tracker-btn"
                onClick={handleSaveToMyPlaces}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Save this location to your Google Maps Places to Visit list"
              >
                {savedToPlacesNotice ? (
                  <>
                    <BookmarkCheck className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Saved!</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="h-3 w-3 text-slate-500" />
                    <span>Save to Places</span>
                  </>
                )}
              </button>

              <button
                id="edit-pinned-location-btn"
                onClick={() => setIsPinModalOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                title="Edit pinned location or context notes"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>

              <button
                id="remove-pinned-location-btn"
                onClick={() => setPinnedLocation(null)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove attached location from this entry"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner if any */}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-medium">Interaction Alert</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium text-rose-600 hover:underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Conversation / Reflection Thread */}
      <div className="mt-6 space-y-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center sm:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Begin Your Multi-Turn Reflection
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
              Write a stream-of-consciousness thought, a challenge you are facing, or an event from today.
              Gemini will provide empathetic guidance, summaries, or actionable ideas.
            </p>

            {/* If no location is pinned, offer one-click pin prompt */}
            {!pinnedLocation && (
              <div className="mt-4">
                <button
                  id="empty-state-pin-location-btn"
                  onClick={() => setIsPinModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                >
                  <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Pin where you are reflecting (e.g. Kyoto, Central Park, Cafe)</span>
                </button>
              </div>
            )}

            {/* Quick Starter Prompts */}
            <div className="mt-6 text-left max-w-lg mx-auto">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-2 text-center">
                Need inspiration? Click a reflection spark:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`prompt-suggestion-${idx}`}
                    onClick={() => {
                      setInputText(prompt);
                    }}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left cursor-pointer"
                  >
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isUser ? user.displayName || 'You' : 'Gemini Partner'}
                  </span>
                  {!isUser && msg.modelUsed && (
                    <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-mono text-indigo-700">
                      {msg.modelUsed}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`relative max-w-3xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-slate-100 rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  {!isUser && (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-[10px] text-slate-400">
                        Isolated in Firestore: /users/{user.uid.slice(0, 6)}...
                      </span>
                      <button
                        onClick={() => handleCopyText(msg.content, index)}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[11px] font-semibold text-slate-500">Gemini Partner</span>
              <span className="text-[10px] text-indigo-600 font-medium">Contemplating with Gemini 3.6 Flash...</span>
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-slate-600 shadow-xs flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-slate-700 font-medium">
                Reflecting deeply & crafting user-isolated summary...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-4 mt-6">
        <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-lg transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <textarea
            id="journal-input-textarea"
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              pinnedLocation
                ? `Reflecting at "${pinnedLocation.localizedName || pinnedLocation.name}"... (Cmd+Enter to send)`
                : "Write your thoughts freely... (Cmd+Enter / Ctrl+Enter to send)"
            }
            disabled={loading}
            className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
            {/* Quick Action Pills for Gemini & Location Pin */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                id="quick-action-pin"
                onClick={() => setIsPinModalOpen(true)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  pinnedLocation
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
                title="Pin or edit geographical location"
              >
                <MapPin className="h-3 w-3 text-indigo-600" />
                <span>{pinnedLocation ? pinnedLocation.localizedName || pinnedLocation.name : 'Pin Location'}</span>
              </button>

              <button
                id="quick-action-summary"
                disabled={loading || (!inputText.trim() && messages.length === 0)}
                onClick={() => handleSendMessage(inputText.trim() || 'Please summarize our discussion so far.', 'summary')}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Generate Executive Summary"
              >
                <ListOrdered className="h-3 w-3" />
                <span>Summarize</span>
              </button>

              <button
                id="quick-action-brainstorm"
                disabled={loading || (!inputText.trim() && messages.length === 0)}
                onClick={() => handleSendMessage(inputText.trim() || 'Brainstorm creative angles on what we discussed.', 'brainstorming')}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Brainstorm New Angles"
              >
                <Lightbulb className="h-3 w-3" />
                <span>Brainstorm</span>
              </button>

              <button
                id="quick-action-actionplan"
                disabled={loading || (!inputText.trim() && messages.length === 0)}
                onClick={() => handleSendMessage(inputText.trim() || 'What are 3 clear action steps from this reflection?', 'action_plan')}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Extract Action Steps"
              >
                <Brain className="h-3 w-3" />
                <span>Action Steps</span>
              </button>
            </div>

            {/* Primary Submit Button */}
            <button
              id="submit-reflection-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
            >
              <span>Reflect with Gemini</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pin Location Modal */}
      <PinLocationModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSelectLocation={(loc) => {
          setPinnedLocation(loc);
          setSaveStatus('idle');
        }}
        currentLocation={pinnedLocation}
        userId={user.uid}
      />
    </div>
  );
};

