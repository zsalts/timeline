// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
// Los correos que manda Firebase (confirmar dirección, restablecer contraseña)
// salen en español. Sin esto van en inglés, que es el idioma por defecto del
// proyecto. El texto en sí se edita en la consola de Firebase (Authentication →
// Templates), no acá.
auth.languageCode = 'es';

// ---------- Sesión "Recordarme" ----------
// La app guarda su sesión en sessionStorage (se borra al cerrar la pestaña).
// Con "Recordarme" espejamos esas claves en localStorage y las restauramos al
// volver, así no hay que iniciar sesión cada vez. La seguridad real la sigue
// dando el token de Firebase Auth (persistencia local cuando se recuerda).
// 'clubesUsuario' es la lista de clubes de la persona (JSON): puede estar en
// más de uno y 'clubID' es el que tiene abierto ahora.
const CLAVES_SESION = ['usuarioUID', 'userEmail', 'clubID', 'clubesUsuario', 'userRole', 'isClubAdmin', 'isSuperAdmin', 'configClub'];

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

// Clubes a los que pertenece una persona. Una ficha vieja (o la de quien está
// en un solo club) no tiene 'clubes' y vale por su club_id.
export const clubesDeUsuario = (userData) => {
  if (!userData) return [];
  const lista = Array.isArray(userData.clubes) ? userData.clubes.filter(Boolean) : [];
  if (userData.club_id && !lista.includes(userData.club_id)) lista.unshift(userData.club_id);
  return lista;
};

// Función para validar acceso de usuario a un club
export const validateClubAccess = async (userId, clubId) => {
  try {
    const userDoc = await getDoc(doc(db, "usuarios", userId));
    if (!userDoc.exists()) return false;
    return clubesDeUsuario(userDoc.data()).includes(clubId);
  } catch (error) {
    console.error("Error validating club access:", error);
    return false;
  }
};

// Gente de un club. Van dos consultas a propósito: 'club_id' trae a los que
// tienen a este club como principal (incluidas las fichas viejas, que no
// tienen 'clubes') y 'clubes' trae a los que además trabajan para él, como
// las analistas de varios clubes. Se juntan por id, sin repetir.
export const miembrosDelClub = async (clubId) => {
  const porPrincipal = getDocs(query(collection(db, 'usuarios'), where('club_id', '==', clubId)));
  const porLista = getDocs(query(collection(db, 'usuarios'), where('clubes', 'array-contains', clubId)));
  const [a, b] = await Promise.all([porPrincipal, porLista]);
  const porId = new Map();
  [a, b].forEach(snap => snap.forEach(d => porId.set(d.id, { id: d.id, ...d.data() })));
  return [...porId.values()];
};

// ---------- Confirmación del correo ----------
// Al darse de alta se manda un correo de confirmación. No bloquea el uso de
// la app: sirve para saber que la dirección existe y es de quien dice ser
// (la barra de aviso de ui.js insiste hasta que confirme).
// Nunca frena el alta: si el correo no sale, se avisa y se sigue.
export const mandarCorreoDeConfirmacion = async (user) => {
  try {
    await sendEmailVerification(user);
    return true;
  } catch (e) {
    console.error('No se pudo mandar el correo de confirmación:', e);
    return false;
  }
};

// Igual que la anterior pero para las altas que hace un admin: esas cuentas
// se crean por REST (accounts:signUp) para no desloguear al admin, así que
// acá tampoco hay un `user` del SDK, solo el idToken que devolvió el alta.
export const mandarCorreoDeConfirmacionPorToken = async (idToken) => {
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken })
    });
    return r.ok;
  } catch (e) {
    console.error('No se pudo mandar el correo de confirmación:', e);
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

export { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence };