# 🏗️ Arquitectura Multi-Tenant - Timeline Hockey App

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    APLICACIÓN ELECTRON                          │
│                  (app_timeline/main.js)                         │
│  Servidor HTTP Local :3333 + SQLite Local + IPC al Frontend    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (app/)                              │
│                   Vanilla JS + HTML/CSS                         │
│         - login.html (Autenticación & Detección Admin)         │
│         - pages/admin.html (Panel para Mateo)                  │
│         - pages/gestion-usuarios.html (Admin del Club)         │
│         - pages/video.html, carga.html, etc.                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE (Backend)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication (Firebase Auth)                          │  │
│  │  - Usuario = email + contraseña                          │  │
│  │  - UID generado automáticamente                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Firestore (Base de datos NoSQL)                         │  │
│  │  - clubes/{clubId}                                       │  │
│  │  - usuarios/{uid}                                        │  │
│  │  - partidos/{partidoId}                                  │  │
│  │  - facturacion/{clubId}                                  │  │
│  │  - estadisticas/{clubId}                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Security Rules (firestore.rules)                        │  │
│  │  - Multi-tenant isolation                                │  │
│  │  - Role-based access control                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 Roles y Permisos

### 1️⃣ Super-Admin (Mateo)

**Acceso:**
- `admin.html` SOLO
- `login.html` con email/contraseña maestros

**Permisos:**
- ✅ Crear nuevos clubes
- ✅ Ver todos los clubes y facturación
- ✅ Editar configuración de clubs
- ❌ NO accede a datos de partidos (video analysis)
- ❌ NO puede agregar usuarios a clubs directamente

**Datos visibles:**
- Solo colección `clubes` (completa)
- Colección `facturacion` (completa)

---

### 2️⃣ Club-Admin (Ej: admin@tc.hockey)

**Acceso:**
- `index.html` (Historial)
- `gestion-usuarios.html` (Gestión de usuarios del club)
- `pages/video.html` (Ver análisis)
- `pages/carga.html` (Cargar nuevos partidos)

**Permisos:**
- ✅ Ver usuarios de su club
- ✅ Crear usuarios nuevos (genera cobro $50 USD)
- ✅ Desactivar usuarios
- ✅ Ver/cargar/editar partidos de su club
- ❌ NO puede cambiar configuración del club
- ❌ NO puede ver otros clubes

**Datos visibles:**
- Solo usuarios con `club_id = su_club`
- Solo partidos con `club_id = su_club`
- Facturación de su club (si tiene acceso)

---

### 3️⃣ Trainer (Ej: trainer@tc.hockey)

**Acceso:**
- `index.html` (Historial)
- `pages/video.html` (Ver análisis)
- `pages/comparar.html` (Comparar videos)

**Permisos:**
- ✅ VER partidos y análisis
- ✅ VER estadísticas
- ❌ NO puede crear/editar partidos
- ❌ NO puede agregar usuarios
- ❌ NO puede ver configuración del club

---

### 4️⃣ Analyst (Ej: analyst@tc.hockey)

**Acceso:**
- `index.html` (Historial)
- `pages/carga.html` (Cargar partidos)
- `pages/video.html` (Ver análisis)
- `pages/editar.html` (Editar partidos)

**Permisos:**
- ✅ Cargar videos y crear análisis
- ✅ Editar partidos (agregar/modificar cortes)
- ✅ VER partidos
- ❌ NO puede agregar usuarios
- ❌ NO puede desactivar otros usuarios

---

## 🔐 Seguridad: Aislamiento Multi-Tenant

### Firestore Security Rules

#### Patrón 1: Filtro obligatorio `club_id`

```firestore
match /partidos/{partidoId} {
  allow read: if request.auth != null &&
                 getUserData().club_id == resource.data.club_id;
}
```

**Garantía:** Un usuario de club A NO puede:
- Ver partidos de club B
- Aunque intente query sin filtro
- Aunque conozca el ID del documento

---

#### Patrón 2: Validación de ownership

```firestore
match /clubes/{clubId} {
  allow write: if request.auth != null &&
                  request.auth.uid == resource.data.admin_uid;
}
```

**Garantía:** Solo el admin del club puede editar su club

---

#### Patrón 3: Role-based access

```firestore
match /usuarios/{userId} {
  allow create: if request.auth != null &&
                   getUserData().rol == 'club-admin' &&
                   resource.data.club_id == getUserData().club_id;
}
```

**Garantía:** Solo club-admin puede crear usuarios en su club

---

## 💰 Modelo de Facturación

### Costo Base: $0 (Gratis)
- Cada club incluye 2 usuarios:
  1. Trainer (Entrenador)
  2. Analyst (Analista)

### Usuarios Adicionales: $50 USD/mes

Cuando club-admin crea nuevo usuario:

1. **Usuario es creado** en Firebase Auth
2. **Documento de usuario** se inserta en Firestore
3. **Registro de cobro** se agrega en `facturacion/{clubId}`
4. **Contador `total_usuarios`** se incrementa

**Tabla de facturación:**

| Club | Usuarios Base | Usuarios Adicionales | Costo Total |
|------|---|---|---|
| TC Hockey | 2 | 0 | $0 |
| TC Hockey | 2 | 1 (Carlos) | $50 |
| TC Hockey | 2 | 2 (Carlos + Juan) | $100 |
| River SC | 2 | 1 (María) | $50 |

---

## 📱 Flujo de Autenticación

### Paso 1: Login
```
usuario@ejemplo.com + password
        ↓
Firebase Auth.signInWithEmailAndPassword()
        ↓
```

### Paso 2: Detección de Rol
```
¿email == MASTER_EMAIL?
        ↓ Sí                           ↓ No
    sessionStorage.isSuperAdmin='true'     |
        ↓                                   |
    Redirect admin.html         Obtener documento usuarios/{uid}
                                        ↓
                        ¿rol = 'club-admin'?
                        ↓ Sí              ↓ No
                    sessionStorage.isClubAdmin='true'
                        ↓                  ↓
                    Mostrar nav            |
                    "Gestión Usuarios"     |
                        ↓                  ↓
                    Redirect index.html ←──┘
```

### Paso 3: Filtrado automático en Firebase
```
await getDocs(query(
  collection(db, "partidos"),
  where("club_id", "==", miClubId)
))
```

**Garantía:** Firestore rechaza queries sin filtro `club_id`

---

## 🔑 Cómo funciona el Aislamiento

### Escenario: Usuario A intenta acceder a datos de Club B

```javascript
// Usuario A (club_id = "CLUB_A")
const q = query(
  collection(db, "partidos"),
  where("club_id", "==", "CLUB_B")  // Intenta filtrar por otro club
);

// Firestore evalúa la Security Rule:
// allow read: if getUserData().club_id == resource.data.club_id

// ❌ DENEGADO
// Porque:
// - getUserData().club_id = "CLUB_A"
// - resource.data.club_id = "CLUB_B"
// - "CLUB_A" != "CLUB_B"
```

### Escenario: Usuario intenta disable las rules en el cliente

```javascript
// Intenta hackear modificando sessionStorage
sessionStorage.setItem('clubID', 'CLUB_CONTRINCANTE');

// Aún así, Firestore rechaza porque:
// 1. El sessionStorage es solo para UI
// 2. Las reglas se evalúan en el SERVIDOR (Firestore)
// 3. No se puede bypasear desde el cliente
```

---

## 📋 Flujo de Creación de Club

```
Panel Admin.html (Mateo)
        ↓
[Completar Formulario]
  - Club ID: TUCLUB_01
  - Nombre: Tu Club
  - Email Admin: admin@tuclub.com
  - Password: Admin123456
        ↓
[Click "Registrar Club"]
        ↓
1. Firebase Auth.signUp(admin@tuclub.com, password)
   → Devuelve adminUid
        ↓
2. Firestore.setDoc(clubes/TUCLUB_01, {..., admin_uid: adminUid})
        ↓
3. Firestore.setDoc(usuarios/adminUid, {..., club_id: TUCLUB_01, rol: 'club-admin'})
        ↓
4. Firestore.setDoc(facturacion/TUCLUB_01, {..., total_usuarios: 2})
        ↓
✅ Club creado y listo para usar
        ↓
Club Admin puede:
- Hacer login con admin@tuclub.com
- Ver Gestión de Usuarios
- Crear nuevos usuarios
```

---

## 📊 Flujo de Agregar Usuario al Club

```
Panel Gestión de Usuarios (Club Admin)
        ↓
[Completar Formulario]
  - Nombre: Carlos
  - Email: carlos@tuclub.com
  - Rol: Trainer
        ↓
[Click "Crear Usuario y Registrar Cobro"]
        ↓
1. Firebase Auth.signUp(carlos@tuclub.com, password)
   → Devuelve carlasUid
        ↓
2. Firestore.setDoc(usuarios/carlosUid, {..., club_id: TUCLUB_01, rol: 'trainer'})
        ↓
3. Firestore.updateDoc(facturacion/TUCLUB_01, {
     usuarios_adicionales: [..., {uid, email, rol, fecha_cobro}],
     total_usuarios: 3
   })
        ↓
4. Firestore.updateDoc(clubes/TUCLUB_01, {usuarios_activos: 3})
        ↓
✅ Usuario creado
   $50 USD registrado en facturación
   Email de bienvenida se podría enviar (futuro)
```

---

## 🚨 Garantías de Seguridad

### ✅ Confirmadas por Firestore Rules

1. **Multi-tenant Isolation**
   - Usuario A no ve datos de Club B
   - Implementado por: `club_id` filter obligatorio

2. **Role-based Access Control**
   - Trainer NO puede crear usuarios
   - Analyst NO puede cambiar rol de usuarios
   - Implementado por: `getUserData().rol` validation

3. **Admin Ownership**
   - Solo admin del club edita su configuración
   - Implementado por: `request.auth.uid == resource.data.admin_uid`

4. **Ownership of Creations**
   - Solo quien crea un partido puede editarlo (o su admin)
   - Implementado por: validación en `allow update`

5. **Read-only for Some Operations**
   - Trainer NO puede hacer `deleteDoc()`
   - Implementado por: `allow delete: if false` o rol validation

---

## 🔄 Sincronización Local (SQLite)

### Propósito
- Offline support (app funciona sin internet)
- Caché local para respuesta rápida
- Respaldo local de datos

### Flujo
```
Usuario crea partido
        ↓
1. Guardar en SQLite local (instantáneo)
2. Mostrar en UI (respuesta inmediata)
        ↓
Backend sincroniza
        ↓
3. Conectar con Firestore (async)
4. Si internet: subir a Firebase
5. Si offline: encolar cambios
6. Si vuelve online: sincronizar cola
```

**Estado Actual:** SQLite está implementado pero la sincronización está pendiente (FASE 3)

---

## 🎯 Checklist de Seguridad Pre-Producción

- [ ] Firestore Security Rules publicadas
- [ ] UID de super-admin en rules
- [ ] Email/contraseña de super-admin en firebase.js
- [ ] `.env.local` en `.gitignore`
- [ ] Firebase backups configurados
- [ ] Email de recuperación funciona
- [ ] 2FA enabled en Firebase Console
- [ ] Test: Usuario A NO ve datos de Club B
- [ ] Test: Trainer NO puede crear usuarios
- [ ] Test: Analista puede crear partidos

---

## 📚 Referencias

- Firebase Docs: https://firebase.google.com/docs/firestore/security
- Firestore Best Practices: https://firebase.google.com/docs/firestore/best-practices
- Multi-tenancy patterns: https://firebase.google.com/docs/firestore/solutions/multi-tenant
