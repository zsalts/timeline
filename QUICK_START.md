# ⚡ Quick Start - Timeline Hockey App

Guía rápida para empezar a usar la app tras FASE 1.

---

## 🚀 En 5 Minutos

### 1. Actualizar el email del super-admin (1 min)

Edita `app/assets/js/firebase.js`:

```javascript
export const MASTER_EMAIL = "tu-email@tudominio.com";  // ← CAMBIA ESTO
```

> ⚠️ La contraseña NO va en este archivo (es código público del navegador).
> Se define solo en Firebase Auth; para recuperarla usá "¿Olvidaste tu contraseña?" en el login.

---

### 2. Publicar Firestore Rules (2 min)

```bash
firebase deploy --only firestore:rules
```

Si sale error, primero:
```bash
npm install -g firebase-tools
firebase login
firebase use proyecto-hockey-169f4
firebase deploy --only firestore:rules
```

---

### 3. Iniciar app (1 min)

```bash
npm start
```

Abre: `http://localhost:3333/pages/login.html`

---

### 4. Login como Admin (1 min)

- Email: `tu-email@tudominio.com` (el que pusiste en firebase.js)
- Contraseña: `TuPassword123!` (la que pusiste en firebase.js)

✅ Deberías ver el panel admin (3 pestañas)

---

## 📱 Crear Primer Club

### En el Panel Admin:

**Pestaña 1: Crear Club**

| Campo | Ejemplo |
|-------|---------|
| ID del Club | `MICLUB_01` |
| Nombre del Equipo | `Mi Club Hockey` |
| Email del Admin | `admin@miclub.com` |
| Contraseña | `Admin123456` |
| Color | (elige uno) |

Click: **"Registrar Club"**

✅ Club creado

---

## 👥 Usar el Club

### Login como Admin del Club:
- Email: `admin@miclub.com`
- Contraseña: `Admin123456`

### En index.html:
- Ves: "Historial de Partidos"
- Navbar: Nuevo item "👥 Gestión de Usuarios"

### Click en "Gestión de Usuarios":
- Ver 2 usuarios (Trainer + Analyst) - incluidos
- Botón: "Agregar Nuevo Usuario"

### Agregar Trainer/Analyst:
| Campo | Ejemplo |
|-------|---------|
| Nombre | `Carlos García` |
| Email | `carlos@miclub.com` |
| Contraseña | `Carlos123456` |
| Rol | Trainer o Analyst |

Click: **"Crear Usuario y Registrar Cobro"**

✅ Usuario creado
✅ $50 USD registrado

---

## 🔐 Verificar Seguridad

### Test 1: Multi-tenant isolation
1. Crea 2 clubes diferentes
2. Login como admin de club 1
3. Verifica: No ves datos de club 2 ✅

### Test 2: Solo Mateo accede a admin
1. Login con email normal (no Mateo)
2. Intenta ir a `/pages/admin.html`
3. Deberías ser redirigido ✅

### Test 3: Solo club-admin gestiona usuarios
1. Login como Trainer (no admin)
2. Intenta ir a `gestion-usuarios.html`
3. Ver mensaje "Acceso Denegado" ✅

---

## 📚 Documentación Completa

| Archivo | Propósito |
|---------|-----------|
| `SETUP.md` | Instalación detallada |
| `ARCHITECTURE.md` | Cómo funciona internamente |
| `FASE1_COMPLETADA.md` | Qué se hizo en Fase 1 |
| `QUICK_START.md` | Este archivo (guía rápida) |

---

## ❓ Problemas Comunes

### "Usuario o contraseña incorrectos" al login como Mateo
- Verifica que en `firebase.js` línea 19-20 esté exacto tu email/password
- Mayúsculas y minúsculas importan

### No puedo crear club (error en admin.html)
- Verifica que Firestore Security Rules esté publicada
- Abre consola (F12) y lee el error exacto

### Usuario de club A ve datos de club B
- ❌ Las Firestore Rules NO están publicadas
- Ejecuta: `firebase deploy --only firestore:rules`

### El link "Gestión de Usuarios" no aparece
- Verifica que hayas hecho login como club-admin
- Revisa sessionStorage: `sessionStorage.isClubAdmin` debe ser `'true'`

---

## ✅ Checklist Inicial

- [ ] Credenciales de Mateo actualizadas en `firebase.js`
- [ ] `firebase deploy` ejecutado exitosamente
- [ ] App iniciada con `npm start`
- [ ] Login como Mateo funciona
- [ ] Admin.html se ve correctamente
- [ ] Puedes crear primer club
- [ ] Puedo login como admin del club
- [ ] Ver "Gestión de Usuarios" en navbar
- [ ] Puedo agregar nuevo usuario
- [ ] $50 se registra en facturación

---

## 🎯 Siguiente: Crear Usuarios de Prueba

1. Admin del Club: `admin@prueba.com` / `Admin123456`
2. Trainer: `trainer@prueba.com` / `Trainer123456`
3. Analyst: `analyst@prueba.com` / `Analyst123456`

Cada uno tiene acceso diferente:
- **Trainer:** Solo VER videos
- **Analyst:** Crear/Editar videos
- **Admin:** Gestionar usuarios + Ver todo

---

## 💡 Tips

✨ **Las Firestore Rules son lo más importante**
- Sin ellas publicadas: NO hay seguridad multi-tenant
- Con ellas publicadas: ✅ Seguridad garantizada

✨ **El sessionStorage es solo para UI**
- Guardarla `isSuperAdmin`, `userRole`, etc. para mostrar/ocultar botones
- La seguridad real está en Firestore (servidor)

✨ **Cada club es completamente aislado**
- Datos separados
- Usuarios separados
- Facturación separada

---

## 🔗 Enlaces Útiles

- Firebase Console: https://console.firebase.google.com/
- Proyecto: proyecto-hockey-169f4
- Firestore: proyecto-hockey-169f4 → Firestore Database
- Rules: proyecto-hockey-169f4 → Firestore Database → Rules

---

## 📞 Ayuda

Si algo no funciona:
1. Abre consola (F12)
2. Lee el error exacto
3. Busca en SETUP.md o ARCHITECTURE.md
4. Revisa Firebase Console → Logs

---

**¡Listo para usar! 🎉**

Ahora la app está segura, multi-tenant y lista para comercializar.
