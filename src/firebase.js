import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot,
  runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY',
  authDomain:        'ajuabmp.firebaseapp.com',
  projectId:         'ajuabmp',
  storageBucket:     'ajuabmp.firebasestorage.app',
  messagingSenderId: '681963417089',
  appId:             '1:681963417089:web:96b3b75e8d995b0e501a00',
};

const app  = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot,
  runTransaction, serverTimestamp, Timestamp,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail,
  ref, uploadBytes, getDownloadURL, uploadString,
};

export async function uploadBase64(base64DataUrl, path) {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  return getDownloadURL(storageRef);
}
