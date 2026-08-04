# Plantillas de correo (Firebase Auth)

Los correos que manda la app —confirmar la dirección y restablecer la contraseña— **no
salen del repo**: los manda Firebase con una plantilla que se edita en la consola. Este
archivo es la fuente de verdad del texto; la consola es solo donde se pega.

**Dónde:** [Firebase Console](https://console.firebase.google.com/project/proyecto-hockey-169f4/authentication/emails)
→ Authentication → Templates. Elegí el idioma **Español** en el selector de arriba (el
código ya manda `auth.languageCode = 'es'`, así que Firebase busca esa versión).

**Qué conviene cambiar además del cuerpo:**

- **Nombre del remitente:** `Timeline` (por defecto viene el nombre del proyecto).
- **Responder a:** tu correo, así alguien que responde no escribe al vacío.
- El remitente sigue siendo `noreply@proyecto-hockey-169f4.firebaseapp.com` salvo que
  configures un dominio propio (necesita verificar el dominio en la consola).

**Marcadores que entiende Firebase:** `%LINK%` (obligatorio), `%EMAIL%`, `%DISPLAY_NAME%`,
`%APP_NAME%`. Cualquier otra cosa se manda tal cual.

**Ojo con el HTML:** el editor de Firebase acepta HTML pero descarta los bloques `<style>`.
Todo lo de acá abajo va con estilos en línea y tablas a propósito, que es lo único que
dibujan bien Gmail, Outlook y compañía.

---

## 1. Confirmar la dirección de correo

**Asunto**

```
Confirmá tu correo y entrá a Timeline
```

**Cuerpo**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7; padding:28px 12px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e3e6ea;">

        <tr>
          <td style="background:#0B0E13; padding:22px 28px;">
            <div style="color:#F7C948; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-weight:700;">Timeline</div>
            <div style="color:#EAEEF4; font-size:20px; font-weight:700; margin-top:6px;">Confirmá tu correo</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 28px 6px; color:#1c222b; font-size:15px; line-height:1.6;">
            <p style="margin:0 0 14px;">Hola, %DISPLAY_NAME%:</p>
            <p style="margin:0 0 14px;">
              Alguien creó una cuenta en Timeline con esta dirección (<b>%EMAIL%</b>).
              Si fuiste vos, tocá el botón y listo: queda confirmada.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:14px 28px 8px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#F7C948; border-radius:10px;">
                  <a href="%LINK%" style="display:inline-block; padding:13px 30px; color:#16130A; font-size:15px; font-weight:700; text-decoration:none;">Confirmar mi correo</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 28px 26px; color:#5c6675; font-size:13px; line-height:1.6;">
            <p style="margin:0 0 12px;">
              Si el botón no anda, copiá y pegá esta dirección en el navegador:<br>
              <a href="%LINK%" style="color:#8a6d12; word-break:break-all;">%LINK%</a>
            </p>
            <p style="margin:0;">
              ¿No creaste ninguna cuenta? Ignorá este mensaje: sin confirmar, la dirección no
              queda asociada a nada.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f4f5f7; padding:16px 28px; color:#8a94a3; font-size:12px; line-height:1.5; border-top:1px solid #e3e6ea;">
            Timeline · videoanálisis de hockey<br>
            Este correo se envió automáticamente, pero podés responderlo si necesitás una mano.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
```

---

## 2. Restablecer la contraseña

Mismo criterio, para que los dos correos se sientan de la misma app.

**Asunto**

```
Restablecé tu contraseña de Timeline
```

**Cuerpo**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7; padding:28px 12px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e3e6ea;">

        <tr>
          <td style="background:#0B0E13; padding:22px 28px;">
            <div style="color:#F7C948; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-weight:700;">Timeline</div>
            <div style="color:#EAEEF4; font-size:20px; font-weight:700; margin-top:6px;">Nueva contraseña</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 28px 6px; color:#1c222b; font-size:15px; line-height:1.6;">
            <p style="margin:0 0 14px;">Hola, %DISPLAY_NAME%:</p>
            <p style="margin:0 0 14px;">
              Pediste cambiar la contraseña de la cuenta <b>%EMAIL%</b>. Elegí una nueva desde
              este botón; el link vence en un rato, así que mejor ahora.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:14px 28px 8px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#F7C948; border-radius:10px;">
                  <a href="%LINK%" style="display:inline-block; padding:13px 30px; color:#16130A; font-size:15px; font-weight:700; text-decoration:none;">Elegir contraseña nueva</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 28px 26px; color:#5c6675; font-size:13px; line-height:1.6;">
            <p style="margin:0 0 12px;">
              Si el botón no anda, copiá y pegá esta dirección en el navegador:<br>
              <a href="%LINK%" style="color:#8a6d12; word-break:break-all;">%LINK%</a>
            </p>
            <p style="margin:0;">
              ¿No lo pediste? Ignoralo: tu contraseña sigue siendo la de siempre mientras no
              abras este link.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f4f5f7; padding:16px 28px; color:#8a94a3; font-size:12px; line-height:1.5; border-top:1px solid #e3e6ea;">
            Timeline · videoanálisis de hockey<br>
            Este correo se envió automáticamente, pero podés responderlo si necesitás una mano.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
```

---

## Lo que sigue siendo de Firebase

El link del correo cae en una página de Firebase (`...firebaseapp.com/__/auth/action`) que
dice "tu correo fue verificado" con tipografía de Google y cero marca. Para que caiga en una
página nuestra hay que apuntar el **Customize action URL** de la consola a una página propia
que reciba `?mode=verifyEmail&oobCode=...` y la resuelva con `applyActionCode()`. Es un rato
de trabajo y no está hecho todavía.
