import { auth } from '../lib/firebase';
import { GeminiReflectResponse, JournalMessage, ReflectionMode } from '../types';

export async function requestGeminiReflection(params: {
  prompt: string;
  mode: ReflectionMode;
  history: JournalMessage[];
  title?: string;
}): Promise<GeminiReflectResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Please sign in before consulting Gemini.');
  }

  const idToken = await currentUser.getIdToken();

  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      mode: params.mode,
      history: params.history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      title: params.title || '',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Server responded with status ${response.status} (${response.statusText})`
    );
  }

  const data = await response.json();
  return data;
}

export interface SuggestedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  reason: string;
}

export async function requestGeminiPlaceSuggestions(params: {
  topic?: string;
  mood?: string;
  city?: string;
}): Promise<{ success: boolean; places: SuggestedPlace[]; modelUsed: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Please sign in before consulting Gemini.');
  }

  const idToken = await currentUser.getIdToken();

  const response = await fetch('/api/gemini/suggest-places', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Server responded with status ${response.status} (${response.statusText})`
    );
  }

  return response.json();
}

export interface LocalizedLocationResult {
  localizedName: string;
  originalName: string;
  localizedAddress: string;
  originalAddress: string;
  hasLocalization: boolean;
}

export async function requestLocationLocalization(params: {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}): Promise<LocalizedLocationResult> {
  try {
    const response = await fetch('/api/places/localize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return {
        localizedName: params.name,
        originalName: params.name,
        localizedAddress: params.address || '',
        originalAddress: params.address || '',
        hasLocalization: false,
      };
    }

    return await response.json();
  } catch (err) {
    console.warn('Error localizing location:', err);
    return {
      localizedName: params.name,
      originalName: params.name,
      localizedAddress: params.address || '',
      originalAddress: params.address || '',
      hasLocalization: false,
    };
  }
}

export async function requestReverseGeocode(lat: number, lng: number): Promise<{
  localizedName: string;
  originalName: string;
  localizedAddress: string;
  originalAddress: string;
}> {
  try {
    const response = await fetch(`/api/places/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!response.ok) {
      return {
        localizedName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        originalName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        localizedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        originalAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
    return await response.json();
  } catch (err) {
    console.warn('Reverse geocode fetch error:', err);
    return {
      localizedName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      originalName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      localizedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      originalAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
}

