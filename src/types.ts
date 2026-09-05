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
  editorialSummary?: string;
  priceLevel?: string;
  linkedEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GooglePlacePhoto {
  name: string; // e.g. places/ChIJ.../photos/AUac...
  proxyUrl: string; // /api/places/photo?name=...
  authorAttributions?: Array<{
    displayName: string;
    uri?: string;
    photoUri?: string;
  }>;
  widthPx?: number;
  heightPx?: number;
}

export interface GooglePlaceReview {
  authorName: string;
  authorPhotoUri?: string;
  rating: number;
  text: string;
  relativePublishTimeDescription?: string;
  publishTime?: string;
}

export interface GooglePlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  editorialSummary?: string;
  isOpenNow?: boolean;
  weekdayDescriptions?: string[];
  photos?: GooglePlacePhoto[];
  reviews?: GooglePlaceReview[];
  websiteUri?: string;
  googleMapsUri?: string;
  source: 'google' | 'fallback';
}

export interface RouteStep {
  instruction: string;
  distanceFormatted: string;
  durationFormatted: string;
  maneuver?: string;
}

export interface RouteLeg {
  distanceMeters: number;
  distanceFormatted: string;
  durationSeconds: number;
  durationFormatted: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  startName?: string;
  endName?: string;
  steps: RouteStep[];
}

export interface ItineraryStop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface ItineraryRoute {
  totalDistanceMeters: number;
  totalDistanceFormatted: string;
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  travelMode: 'WALK' | 'DRIVE' | 'TRANSIT' | 'BICYCLE';
  polylinePoints: Array<[number, number]>; // [lat, lng][]
  legs: RouteLeg[];
  optimizedWaypointOrder?: number[];
  stops: ItineraryStop[];
  googleMapsDirectionsUrl: string;
  source: 'google_routes' | 'osrm';
}


