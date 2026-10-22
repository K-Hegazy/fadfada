import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDocFromServer, 
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { User } from './types';

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
    return true;
  }
}

// Trigger initial health check in background
if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

/**
 * 1. Register User in Firebase Auth & Create Firestore Document
 * Document in "users" collection with id = uid:
 *  - email
 *  - role = "basic"
 *  - balance = 0
 *  - isOnline = true
 *  - lastSeen = registration timestamp
 */
export async function firebaseRegisterUser(email: string, password: string, uid?: string): Promise<{ uid: string; email: string }> {
  let firebaseUser: FirebaseUser | null = null;
  
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    firebaseUser = cred.user;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use' || err.code === 'auth/account-exists-with-different-credential') {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = cred.user;
      } catch {}
    }
    if (!firebaseUser) {
      try {
        const cred = await signInAnonymously(auth);
        firebaseUser = cred.user;
      } catch {}
    }
  }

  const docId = uid || firebaseUser?.uid || ('usr_' + Date.now());
  const userDocRef = doc(db, 'users', docId);

  // Exact required payload: email, role="basic", balance=0, isOnline=true, lastSeen=timestamp
  await setDoc(userDocRef, {
    email: email,
    role: 'basic',
    balance: 0,
    isOnline: true,
    lastSeen: serverTimestamp()
  }, { merge: true });

  console.log(`[Firebase Firestore] Created new user document in "users/${docId}" with role=basic, balance=0, isOnline=true`);
  return { uid: docId, email };
}

/**
 * 2. Login User in Firebase Auth & Update Firestore Document
 * Document in "users" collection:
 *  - isOnline = true
 *  - lastSeen = login timestamp
 */
export async function firebaseLoginUser(email: string, password: string, uid?: string): Promise<void> {
  let firebaseUser: FirebaseUser | null = null;
  
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    firebaseUser = cred.user;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = cred.user;
      } catch {
        try {
          const cred = await signInAnonymously(auth);
          firebaseUser = cred.user;
        } catch {}
      }
    }
  }

  const docId = uid || firebaseUser?.uid || auth.currentUser?.uid;
  if (docId) {
    const userDocRef = doc(db, 'users', docId);
    await setDoc(userDocRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    }, { merge: true });
    console.log(`[Firebase Firestore] Updated user "users/${docId}": isOnline=true, lastSeen=now`);
  }
}

/**
 * 3. Logout User in Firebase Auth & Update Firestore Document
 * Document in "users" collection:
 *  - isOnline = false
 *  - lastSeen = logout timestamp
 */
export async function firebaseLogoutUser(uid?: string): Promise<void> {
  const docId = uid || auth.currentUser?.uid;
  if (docId) {
    try {
      const userDocRef = doc(db, 'users', docId);
      await setDoc(userDocRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      }, { merge: true });
      console.log(`[Firebase Firestore] Updated user "users/${docId}": isOnline=false, lastSeen=now`);
    } catch (err: any) {
      console.warn('[Firebase Firestore] Notice while updating logout status:', err.message);
    }
  }
  try {
    await fbSignOut(auth);
  } catch {}
}

/**
 * Sync full user profile in Firestore
 */
export async function syncUserToFirestore(user: User, authUid?: string): Promise<void> {
  if (!user || !user.id) return;
  try {
    const userDocRef = doc(db, 'users', user.id);
    await setDoc(userDocRef, {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role === 'owner' ? 'owner' : (user.role === 'admin' ? 'admin' : 'basic'),
      balance: user.coins || 0,
      isOnline: user.isOnline ?? true,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (err: any) {
    console.warn('[Firebase Firestore] Sync notice:', err.message);
  }
}

/**
 * Firebase Auth Helper: Sign in anonymously for guests
 */
export async function firebaseSignInAnonymous(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err: any) {
    return null;
  }
}

/**
 * Firebase Auth Helper: Google 1-Click Sign-in
 */
export async function firebaseSignInWithGoogle(): Promise<{ email: string; displayName: string; uid: string } | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    return {
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      uid: user.uid
    };
  } catch (err: any) {
    return null;
  }
}
