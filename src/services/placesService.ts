import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import { PlaceOfInterest, PlaceVisitStatus } from '../types';

/**
 * Saves or updates a place of interest in the user-isolated subcollection:
 * /users/{userId}/places/{placeId}
 */
export async function savePlaceOfInterest(
  userId: string,
  place: PlaceOfInterest
): Promise<void> {
  if (!userId) {
    throw new Error('User authentication ID is required to persist place.');
  }

  const cleanPlace = sanitizePayload({
    ...place,
    userId,
    updatedAt: new Date().toISOString(),
  });

  const placeRef = doc(db, 'users', userId, 'places', place.id);
  await setDoc(placeRef, cleanPlace, { merge: true });

  // Record audit trace in interactions
  try {
    const interactionRef = doc(
      db,
      'users',
      userId,
      'interactions',
      `place_${place.id}_${Date.now()}`
    );
    await setDoc(
      interactionRef,
      sanitizePayload({
        placeId: place.id,
        userId,
        placeName: place.name,
        category: place.category,
        status: place.status,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (auditErr) {
    console.warn('Place interaction audit log notice:', auditErr);
  }
}

/**
 * Subscribes to real-time updates for a user's isolated places of interest.
 */
export function subscribeToUserPlaces(
  userId: string,
  onUpdate: (places: PlaceOfInterest[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    return () => {};
  }

  const placesRef = collection(db, 'users', userId, 'places');
  const q = query(placesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const places: PlaceOfInterest[] = [];
      snapshot.forEach((docSnap) => {
        places.push(docSnap.data() as PlaceOfInterest);
      });
      onUpdate(places);
    },
    (err) => {
      console.error('Firestore places subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Fetches all places once for a user.
 */
export async function fetchUserPlaces(userId: string): Promise<PlaceOfInterest[]> {
  if (!userId) {
    return [];
  }
  const placesRef = collection(db, 'users', userId, 'places');
  const q = query(placesRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  const places: PlaceOfInterest[] = [];
  snapshot.forEach((docSnap) => {
    places.push(docSnap.data() as PlaceOfInterest);
  });
  return places;
}

/**
 * Updates an existing place of interest with custom updates (name, address, coordinates, category, status, notes, rating, etc.).
 */
export async function updatePlaceOfInterest(
  userId: string,
  placeId: string,
  updates: Partial<Omit<PlaceOfInterest, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!userId || !placeId) {
    throw new Error('User ID and Place ID required to update place.');
  }
  const placeRef = doc(db, 'users', userId, 'places', placeId);
  const cleanUpdates = sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(placeRef, cleanUpdates, { merge: true });

  // Record audit trace in interactions
  try {
    const interactionRef = doc(
      db,
      'users',
      userId,
      'interactions',
      `edit_${placeId}_${Date.now()}`
    );
    await setDoc(
      interactionRef,
      sanitizePayload({
        placeId,
        userId,
        action: 'edit_place',
        updates: cleanUpdates,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (auditErr) {
    console.warn('Place update audit log notice:', auditErr);
  }
}

/**
 * Updates status of a place (want_to_visit, visited, favorite).
 */
export async function updatePlaceStatus(
  userId: string,
  placeId: string,
  status: PlaceVisitStatus
): Promise<void> {
  if (!userId || !placeId) return;
  const placeRef = doc(db, 'users', userId, 'places', placeId);
  await updateDoc(
    placeRef,
    sanitizePayload({
      status,
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Updates personal notes for a place.
 */
export async function updatePlaceNotes(
  userId: string,
  placeId: string,
  notes: string
): Promise<void> {
  if (!userId || !placeId) return;
  const placeRef = doc(db, 'users', userId, 'places', placeId);
  await updateDoc(
    placeRef,
    sanitizePayload({
      notes,
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Deletes a place of interest securely from /users/{userId}/places/{placeId}.
 */
export async function deletePlaceOfInterest(
  userId: string,
  placeId: string
): Promise<void> {
  if (!userId || !placeId) {
    throw new Error('User ID and Place ID required for deletion.');
  }
  const placeRef = doc(db, 'users', userId, 'places', placeId);
  await deleteDoc(placeRef);
}

// ==========================================
// USER CUSTOM MULTI-LIST MANAGEMENT
// ==========================================

import { PlaceList } from '../types';

export const STARTER_DEFAULT_LISTS: Omit<PlaceList, 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'list_favorites',
    name: 'Must-Visit Highlights',
    description: 'Top priority landmarks, iconic spots, and favorite places',
    color: 'amber',
    icon: 'Heart',
    isDefault: true,
  },
  {
    id: 'list_food_cafes',
    name: 'Food & Cafe Crawl',
    description: 'Curated coffee shops, street food, and local eateries',
    color: 'emerald',
    icon: 'Coffee',
  },
  {
    id: 'list_scenic_nature',
    name: 'Scenic & Photography',
    description: 'Nature trails, viewpoint overlooks, and photo spots',
    color: 'sky',
    icon: 'Camera',
  },
];

/**
 * Saves or updates a custom list in /users/{userId}/lists/{listId}
 */
export async function savePlaceList(
  userId: string,
  list: PlaceList
): Promise<void> {
  if (!userId || !list.id) {
    throw new Error('User ID and List ID required to save list.');
  }

  const cleanList = sanitizePayload({
    ...list,
    userId,
    updatedAt: new Date().toISOString(),
  });

  const listRef = doc(db, 'users', userId, 'lists', list.id);
  await setDoc(listRef, cleanList, { merge: true });
}

/**
 * Subscribes to real-time custom lists for a user.
 */
export function subscribeToUserLists(
  userId: string,
  onUpdate: (lists: PlaceList[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    return () => {};
  }

  const listsRef = collection(db, 'users', userId, 'lists');
  const q = query(listsRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const lists: PlaceList[] = [];
      snapshot.forEach((docSnap) => {
        lists.push(docSnap.data() as PlaceList);
      });
      onUpdate(lists);
    },
    (err) => {
      console.error('Firestore lists subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Updates a custom list's properties (name, description, color, icon).
 */
export async function updatePlaceList(
  userId: string,
  listId: string,
  updates: Partial<Omit<PlaceList, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!userId || !listId) {
    throw new Error('User ID and List ID required to update list.');
  }
  const listRef = doc(db, 'users', userId, 'lists', listId);
  const cleanUpdates = sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(listRef, cleanUpdates);
}

/**
 * Deletes a custom list from /users/{userId}/lists/{listId}.
 */
export async function deletePlaceList(
  userId: string,
  listId: string
): Promise<void> {
  if (!userId || !listId) {
    throw new Error('User ID and List ID required to delete list.');
  }
  const listRef = doc(db, 'users', userId, 'lists', listId);
  await deleteDoc(listRef);
}
