# 🏒 Setup y Configuración - Timeline Hockey App

## 📋 Requisitos
- Node.js 14+
- Electron 29.1.0
- Firebase project configurado
- SQLite3

## 🔐 PASO 1: Configurar Credenciales del Super-Admin (CRÍTICO)

### 1.1 Actualizar el email del super-admin
Edita `app/assets/js/firebase.js` con tu email real:

```javascript
export const MASTER_EMAIL = "tu-email-real@tudominio.com";  // Tu email
```

**⚠️ IMPORTANTE:** La contraseña NUNCA va en `firebase.js` — ese archivo es código
público que cualquiera puede leer desde el navegador. La contraseña vive únicamente
en Firebase Auth (la escribís al loguearte) y, si querés anotarla, en `.env.local`
(que no se versiona). La protección real del panel la dan las Firestore Rules por UID.

### 1.2 Actualizar UID en firestore.rules
En el archivo `firestore.rules` línea 12, reemplaza "MATEO_UID_AQUI" con tu UID real de Firebase:

```firestore
match /super-admin/{document=**} {
  allow read, write: if request.auth.uid == "YOUR_ACTUAL_UID";
}
```

Para obtener tu UID:
1. Inicia sesión en Firebase Console
2. Crea un usuario con las credenciales de admin
3. Ve a "Authentication" → Busca tu usuario
4. Copia el UID y pégalo en firestore.rules

---

## 🔑 PASO 2: Publicar Firebase Security Rules

### 2.1 Descargar Firebase CLI
```bash
npm install -g firebase-tools
```

### 2.2 Iniciar sesión en Firebase
```bash
firebase login
```

### 2.3 Seleccionar proyecto
```bash
firebase use proyecto-hockey-169f4
```

### 2.4 Publicar reglas de seguridad
```bash
firebase deploy --only firestore:rules
```

**Verificar:** Ve a Firebase Console → Firestore → Rules → Verifica que las reglas se hayan actualizado

---

## 👥 PASO 3: Crear Primer Club

### 3.1 Iniciar la app
```bash
npm start
```

### 3.2 Ir a Login
- URL: `http://localhost:3333/pages/login.html`

### 3.3 Ingresar como Super-Admin
- Email: (tu email de admin configurado en firebase.js)
- Contraseña: (tu password configurado en firebase.js)

### 3.4 Acceder a Panel Admin
- Se redirige automáticamente a `admin.html`

### 3.5 Crear club
En la pestaña "Crear Club":
1. ID del Club: `TUCLUB_01` (sin espacios, mayúsculas)
2. Nombre del Equipo: `Tu Club Hockey`
3. Email del Admin del Club: `admin@tuclub.com`
4. Contraseña Inicial: `Admin123456`
5. Color Principal: (seleccionar color)

**Click en "Registrar Club"**

---

## 🧪 PASO 4: Probar Acceso Multi-Tenant

### 4.1 Login como Admin del Club
- Email: `admin@tuclub.com`
- Contraseña: `Admin123456`

### 4.2 Acceder a Gestión de Usuarios
- En el menu: `👥 Gestión de Usuarios`
- Ver 2 usuarios iniciales (Trainer + Analyst)

### 4.3 Crear usuario adicional
- Click en "Agregar Nuevo Usuario"
- Completar datos
- Click en "Crear Usuario y Registrar Cobro"
- ✅ Debe registrar $50 USD en facturación

### 4.4 Verificar aislamiento de datos
- Crear otro club
- Login como admin del segundo club
- ✅ NO debe ver datos del primer club (aislamiento garantizado por Firestore Rules)

---

## 📚 Estructura de Datos en Firestore

### Colecciones

#### `clubes/`
```json
{
  "nombre": "TC Hockey",
  "color_primario": "#1c2c54",
  "admin_uid": "uid_del_admin",
  "usuarios_activos": 2,
  "fecha_creacion": timestamp,
  "estado": "activo",
  "authorized_uids": ["uid_admin", "uid_user1", "uid_user2"]
}
```

#### `usuarios/`
```json
{
  "email": "admin@club.com",
  "club_id": "TUCLUB_01",
  "rol": "club-admin|trainer|analyst",
  "nombre": "Juan Admin",
  "estado": "activo"
}
```

#### `partidos/`
```json
{
  "club_id": "TUCLUB_01",  // CRÍTICO: filtro de acceso
  "mi_equipo": "TC",
  "rival": "River",
  "fecha": "2024-06-15",
  "torneo": "Campeonato",
  "video_url": "https://youtube.com/watch?v=...",
  "estadisticas": {...},
  "creado_por": "uid_user",
  "importante": false
}
```

#### `facturacion/`
```json
{
  "admin_uid": "uid_admin",
  "usuarios_base": 2,
  "usuarios_adicionales": [
    {
      "uid": "uid_user3",
      "email": "user3@club.com",
      "nombre": "Carlos",
      "rol": "trainer",
      "fecha_cobro": timestamp
    }
  ],
  "precio_por_usuario": 50,
  "total_usuarios": 3,
  "fecha_creacion": timestamp
}
```

---

## 🔒 Seguridad Implementada

✅ **Super-Admin (Mateo)**
- Solo accede a `admin.html`
- Puede crear/editar clubes
- Ver facturación de todos los clubes

✅ **Club-Admin**
- Accede a gestión de usuarios de su club
- Puede crear usuarios (genera cobro)
- Puede desactivar usuarios (no borrar)
- Ve solo partidos de su club

✅ **Trainer/Analyst**
- Ven solo partidos de su club
- Permisos específicos por rol (ver vs crear)
- NO pueden acceder a gestión de usuarios

✅ **Firestore Rules**
- Filtro `club_id` obligatorio en todas las queries
- Validación de ownership en actualización/eliminación
- Roles basados en rol del usuario

---

## 📝 Variables de Ambiente (.env.local)

El archivo `.env.local` (no versionado en git) contiene:

```env
VITE_FIREBASE_MASTER_EMAIL=tu-email@ejemplo.com
VITE_FIREBASE_MASTER_PASSWORD=TuPassword123!
VITE_FIREBASE_API_KEY=AIzaSyAm...
VITE_FIREBASE_AUTH_DOMAIN=proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
```

**Nota:** `.env.local` está en `.gitignore` - nunca se commitea

---

## 🚀 Checklist Pre-Producción

- [ ] Credenciales de super-admin actualizadas en `firebase.js`
- [ ] UID de super-admin actualizado en `firestore.rules`
- [ ] Firebase Security Rules publicadas con `firebase deploy`
- [ ] Primer club creado y probado
- [ ] Acceso multi-tenant verificado (usuario de club A no ve datos de club B)
- [ ] Cobro de usuarios adicionales registrado en facturación
- [ ] `.env.local` protegido en `.gitignore`
- [ ] Email de recuperación de contraseña configurado en Firebase
- [ ] Backups de Firestore configurados

---

## 🐛 Troubleshooting

### "Usuario o contraseña incorrectos" al login como super-admin
- Verifica que las credenciales en `firebase.js` sean exactas
- Revisa que el usuario exista en Firebase Console → Authentication

### "Acceso Denegado" al entrar a admin.html
- Verifica `sessionStorage.isSuperAdmin === 'true'`
- Abre consola (F12) y revisa errores
- Asegúrate de que el email coincida exactamente con `MASTER_EMAIL`

### Firestore Rules no funcionan
- Abre Firebase Console → Firestore → Rules
- Verifica que se hayan publicado correctamente
- Test las reglas desde "Firestore Rules Playground"

### Usuario puede ver datos de otro club
- ❌ Las Firestore Rules NO están activas
- Ejecuta `firebase deploy --only firestore:rules`
- Verifica el UID en la regla `super-admin`

---

## 📞 Soporte

Para preguntas sobre la configuración:
1. Revisa los logs en consola (F12)
2. Verifica Firebase Console → Logs
3. Consulta la documentación de Firebase en https://firebase.google.com/docs

---

## 🔄 Próximos Pasos

1. **FASE 2:** Refactorización de código (eliminar duplicación)
2. **FASE 3:** Sincronización offline con SQLite
3. **FASE 4:** Tests unitarios

Consulta `revisa-todo-este-codigo-eager-bee.md` en `.claude/plans/` para el plan completo.
