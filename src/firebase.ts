import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Initialize Firebase Authentication
export const auth = getAuth(firebaseApp);

// Initialize Cloud Firestore database with configured database ID
export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Connection test on boot as required by Firebase integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is currently offline or unreachable.');
      return false;
    }
    // Expected PERMISSION_DENIED or NOT_FOUND indicates successful server reachability
    return true;
  }
}

// Trigger initial health check in background
if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}
