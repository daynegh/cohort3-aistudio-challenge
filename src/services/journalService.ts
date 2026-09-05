import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import { JournalEntry } from '../types';

/**
 * Saves or updates a journal entry in the strictly user-isolated collection:
 * /users/{userId}/entries/{entryId}
 */
export async function saveJournalEntry(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  if (!userId) {
    throw new Error('User authentication ID is required to persist journal entry.');
  }

  const cleanEntry = sanitizePayload({
    ...entry,
    userId,
    updatedAt: new Date().toISOString(),
  });

  const entryRef = doc(db, 'users', userId, 'entries', entry.id);
  await setDoc(entryRef, cleanEntry, { merge: true });

  // Also record the interaction history in the interactions subcollection for auditability
  try {
    const interactionRef = doc(db, 'users', userId, 'interactions', `${entry.id}_${Date.now()}`);
    await setDoc(
      interactionRef,
      sanitizePayload({
        entryId: entry.id,
        userId,
        timestamp: new Date().toISOString(),
        mode: entry.mode,
        messageCount: entry.messages.length,
        title: entry.title,
      })
    );
  } catch (auditErr) {
    console.warn('Audit interaction log warning:', auditErr);
  }
}

/**
 * Subscribes to real-time updates for a user's isolated journal entries.
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Fetches all entries once for a user.
 */
export async function fetchUserEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) {
    return [];
  }
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  const entries: JournalEntry[] = [];
  snapshot.forEach((docSnap) => {
    entries.push(docSnap.data() as JournalEntry);
  });
  return entries;
}

/**
 * Deletes a journal entry securely from /users/{userId}/entries/{entryId}
 */
export async function deleteJournalEntry(
  userId: string,
  entryId: string
): Promise<void> {
  if (!userId || !entryId) {
    throw new Error('User ID and Entry ID required for deletion.');
  }
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}
