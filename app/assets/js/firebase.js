// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// ---------- Sesión "Recordarme" ----------
// La app guarda su sesión en sessionStorage (se borra al cerrar la pestaña).
// Con "Recordarme" espejamos esas claves en localStorage y las restauramos al
// volver, así no hay que iniciar sesión cada vez. La seguridad real la sigue
// dando el token de Firebase Auth (persistencia local cuando se recuerda).
const CLAVES_SESION = ['usuarioUID', 'userEmail', 'clubID', 'userRole', 'isClubAdmin', 'isSuperAdmin', 'configClub'];

// Si no hay sesión activa pero quedó una recordada, la restaura. Se llama al
// importar este módulo (los imports se evalúan antes del código de la página),
// así las páginas encuentran la sesión y no redirigen al login.
export function restaurarSesionRecordada() {
  try {
    if (localStorage.getItem('recordarSesion') !== '1') return false;
    if (sessionStorage.getItem('usuarioUID')) return true;   // ya hay sesión
    let restaurado = false;
    CLAVES_SESION.forEach(k => {
      const v = localStorage.getItem(k);
      if (v != null) { sessionStorage.setItem(k, v); restaurado = true; }
    });
    return restaurado;
  } catch (e) { return false; }
}

// Guarda o limpia la sesión recordada según el check "Recordarme".
export function guardarSesionRecordada(recordar) {
  try {
    if (recordar) {
      localStorage.setItem('recordarSesion', '1');
      CLAVES_SESION.forEach(k => {
        const v = sessionStorage.getItem(k);
        if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k);
      });
    } else {
      localStorage.removeItem('recordarSesion');
      CLAVES_SESION.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) { /* localStorage no disponible: seguimos con sessionStorage */ }
}

// Limpia toda la sesión (para el logout).
export function limpiarSesion() {
  try {
    sessionStorage.clear();
    localStorage.removeItem('recordarSesion');
    CLAVES_SESION.forEach(k => localStorage.removeItem(k));
  } catch (e) { try { sessionStorage.clear(); } catch (_) { } }
}

// Auto-restaurar al cargar cualquier página que use Firebase.
restaurarSesionRecordada();

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

export { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, writeBatch, increment, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence };