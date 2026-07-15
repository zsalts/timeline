// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Configuración de Firebase desde variables de ambiente
// Actualizar estos valores desde .env.local en la raíz del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyAm7hCCz4pIHb9DER9AhVYZEON_3pt7ChU",
  authDomain: "proyecto-hockey-169f4.firebaseapp.com",
  projectId: "proyecto-hockey-169f4",
  storageBucket: "proyecto-hockey-169f4.firebasestorage.app",
  messagingSenderId: "183662210278",
  appId: "1:183662210278:web:bc9a71855e6faa85185f27",
  measurementId: "G-36JC6EMJXZ"
};

// Email del Super-Admin. Solo identifica QUIÉN es el admin; la seguridad
// real la dan Firebase Auth (contraseña) y las Firestore Rules (por UID).
// La contraseña NUNCA va en este archivo: es código público del navegador.
export const MASTER_EMAIL = "mateotesta2016@gmail.com";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Función para validar si un usuario es super-admin
export const isMasterAdmin = (email) => {
  return email === MASTER_EMAIL;
};

// Función para validar acceso de usuario a un club
export const validateClubAccess = async (userId, clubId) => {
  try {
    const userDoc = await getDoc(doc(db, "usuarios", userId));
    if (!userDoc.exists()) return false;
    return userDoc.data().club_id === clubId;
  } catch (error) {
    console.error("Error validating club access:", error);
    return false;
  }
};

// Función para obtener información del usuario
export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "usuarios", userId));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
};

// Función para obtener información del club
export const getClubData = async (clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, "clubes", clubId));
    return clubDoc.exists() ? clubDoc.data() : null;
  } catch (error) {
    console.error("Error getting club data:", error);
    return null;
  }
};

export { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, writeBatch, increment, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };