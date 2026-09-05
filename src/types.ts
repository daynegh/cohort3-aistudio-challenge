export type ReflectionMode = 'reflection' | 'summary' | 'brainstorming' | 'action_plan';

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface PinnedJournalLocation {
  name: string;
  originalName?: string;
  localizedName?: string;
  address: string;
  originalAddress?: string;
  localizedAddress?: string;
  lat: number;
  lng: number;
  placeId?: string;
  category?: PlaceCategory;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  mood?: string;
  messages: JournalMessage[];
  summary?: string;
  actionItems?: string[];
  location?: PinnedJournalLocation | null;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface UserAuthProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface GeminiReflectResponse {
  success: boolean;
  text: string;
  modelUsed: string;
  mode: ReflectionMode;
}

export type PlaceVisitStatus = 'want_to_visit' | 'visited' | 'favorite';

export type PlaceCategory =
  | 'nature_parks'
  | 'cafes_food'
  | 'arts_culture'
  | 'historical'
  | 'travel_lodging'
  | 'activities'
  | 'other';

export interface PlaceList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string; // e.g., 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'fuchsia' | 'teal'
  icon?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOfInterest {
  id: string;
  userId: string;
  name: string;
  originalName?: string;
  localizedName?: string;
  address: string;
  originalAddress?: string;
  localizedAddress?: string;
  lat: number;
  lng: number;
  placeId?: string;
  category: PlaceCategory;
  status: PlaceVisitStatus;
  listId?: string;
  listIds?: string[];
  notes?: string;
  rating?: number;
  tags?: string[];
  photoUrl?: string;
  linkedEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

