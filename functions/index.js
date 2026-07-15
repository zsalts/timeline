// =========================================================
// Cloud Functions — Timeline
// =========================================================
// Única función: borrar cuentas de Firebase Auth de un club cuando el
// super-admin elimina el club de forma permanente. El borrado de las cuentas
// de OTROS usuarios solo se puede hacer server-side (Admin SDK); desde el
// navegador es imposible. Esta función lo permite hacer desde el panel admin.
//
// Requiere plan Blaze (pay-as-you-go) para desplegar Cloud Functions.
// Deploy:  firebase deploy --only functions

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// UID del super-admin (Mateo). Debe coincidir con isSuper() de firestore.rules.
const SUPER_UID = "O8unkbKHhPXg1ZvRexlKUzccOym1";

// Borra las cuentas de Auth cuyos UIDs se pasen. Solo el super-admin puede
// llamarla. Devuelve cuántas se borraron y los errores por UID.
exports.eliminarCuentasAuth = onCall(async (request) => {
  if (!request.auth || request.auth.uid !== SUPER_UID) {
    throw new HttpsError("permission-denied", "Solo el super-admin puede borrar cuentas.");
  }

  const uids = Array.isArray(request.data && request.data.uids)
    ? request.data.uids.filter((u) => typeof u === "string" && u.length)
    : [];

  if (!uids.length) return { borradas: 0, errores: [] };

  let borradas = 0;
  const errores = [];

  // deleteUsers acepta hasta 1000 UIDs por llamada
  for (let i = 0; i < uids.length; i += 1000) {
    const lote = uids.slice(i, i + 1000);
    const res = await admin.auth().deleteUsers(lote);
    borradas += res.successCount;
    res.errors.forEach((e) => errores.push({
      uid: lote[e.index],
      msg: e.error.message,
    }));
  }

  return { borradas, errores };
});
