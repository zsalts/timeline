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

## 🧭 Una persona, varios clubes

El modelo original era **una cuenta = un club** (`usuarios/{uid}.club_id`). Hoy una
persona puede trabajar para varios: el caso típico es la **analista** que sigue a
más de un equipo.

**Cómo se guarda:**

| campo | qué es |
|---|---|
| `usuarios/{uid}.clubes` | todos los clubes de esa persona (array) |
| `usuarios/{uid}.club_id` | el club "casa": el que se abre por defecto y donde vive su ficha |
| `clubes/{id}.admin_uid` | quién manda en ESE club |

Las fichas viejas no tienen `clubes` y valen por su `club_id`: eso lo resuelve
`clubesDeUsuario()` en `app/assets/js/firebase.js` y su gemela `clubesDe(ficha)` en
`firestore.rules`. Toda regla que antes comparaba `club_id == club_id` ahora usa
`esMiClub(c)`.

**Mandar en un club es ser su `admin_uid`, no tener el rol `club-admin`.** El rol es
uno solo para toda la cuenta: si "ser admin" lo diera el rol, quien crea un club
propio pasaría a mandar también donde solo es analista. Por eso la sesión guarda
`isClubAdmin` recalculado club por club, y las reglas preguntan `esAdminDe(c)`.

**Qué puede hacer cada una:**

- **Crear un club nuevo** desde una cuenta que ya existe: solo las analistas
  (`registro.html` en modo "con sesión"; la regla de `clubes/create` pide
  `userDoc().rol == 'analyst'`). Queda como su `admin_uid` y administra ese club
  aunque su rol de cuenta siga siendo "analista".
- **Cambiar de club abierto:** tocando el nombre del club arriba a la izquierda
  (`ui.js`). Rehace la sesión con `abrirClub()` de `firebase.js`, que es el único
  lugar donde se escribe `clubID` / `configClub` / `isClubAdmin`.
- **Ver todos sus clubes:** `pages/mis-clubes.html` (plan, partidos, gente, cuáles
  administra). Es además la página que pone al día la lista de clubes de la sesión.
- **Ver los partidos de todos sus clubes juntos:** el selector "Todos mis clubes"
  del historial. Es de lectura: abrir un partido de otro club cambia el club abierto.
- **Cargar un partido a cualquiera de sus clubes:** el selector "Club" de
  `carga.html`. Los equipos, el tope del plan y el contador son del club destino.
- **Pasar la administración de un club:** desde Usuarios, a cualquiera del club que
  no sea jugadora (`traspasoDeAdmin()` en las reglas). Solo se puede **entregar**:
  para escribir `admin_uid` hay que ser el admin actual.

---

## 🔐 Seguridad: Aislamiento Multi-Tenant

### Firestore Security Rules

#### Patrón 1: el club del documento tiene que ser uno de los míos

```firestore
match /partidos/{partidoId} {
  allow read: if isSuper() ||
    (userExists() && esMiClub(resource.data.club_id));
}
```

`esMiClub(c)` es `c in clubesDe(userDoc())`. Reemplaza al viejo
`getUserData().club_id == resource.data.club_id`: desde que alguien puede estar en
varios clubes, "mi club" no es uno solo.

**Garantía:** un usuario de club A NO puede ver partidos de club B
- Aunque intente query sin filtro
- Aunque conozca el ID del documento

---

#### Patrón 2: Validación de ownership

```firestore
match /clubes/{clubId} {
  allow update: if isSuper() ||
    (esAdminDelClub() && (camposEditablesPorAdminClub() || traspasoDeAdmin()));
}
```

**Garantía:** solo el admin del club lo edita, y solo los campos de su propia
configuración (`nombre`, `logo`, `equipos`, `mapeoEstadisticas`,
`usuarios_activos`). Lo comercial y estructural (`plan`, `estado`,
`partidos_count`) queda afuera. `admin_uid` se mueve únicamente por
`traspasoDeAdmin()`, que lo entrega a otra persona del club y a nada más.

---

#### Patrón 3: crear usuarios lo hace quien manda en el club

```firestore
match /usuarios/{userId} {
  allow create: if isSuper() ||
    esAdminDe(request.resource.data.club_id) ||
    ... // auto-registro y alta por link de invitación
}
```

`esAdminDe(c)` es `clubDoc(c).admin_uid == request.auth.uid`, no el rol de la
cuenta.

**Garantía:** solo quien manda en ese club da de alta a su gente

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
