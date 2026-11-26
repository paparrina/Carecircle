# CareCircle — Guía de despliegue a producción

## 1. Supabase (backend)
1. Crea el proyecto en https://supabase.com → **región `eu-central-1` (Frankfurt)**.
2. Aplica las migraciones de `supabase/migrations/` en orden numérico.
   En una base existente, comprueba primero qué cambios están activos. Antes de
   aplicar `0007`, revisa las fichas con rutas de archivo duplicadas, fuera de su
   círculo o en carpetas de otro círculo. La migración se revierte si encuentra
   alguna de estas inconsistencias.
3. Verifica el cron: Database → Cron Jobs → debe existir
   `carecircle-notification-sweep` (*/5). Si no, actívalo ahí apuntando a
   `select public.run_notification_sweep();`
4. Authentication → Providers: **Email** (confirmación activada) y **Google**
   (Client ID/Secret de Google Cloud Console; redirect URI:
   `https://TU-REF.supabase.co/auth/v1/callback`).
5. Authentication → URL Configuration:
   - Site URL: `https://tu-dominio.com`
   - Redirect URLs: `https://tu-dominio.com/auth/callback`

## 2. Resend (email)
1. Crea cuenta en https://resend.com, verifica tu dominio y genera la API key.
2. Guarda `RESEND_API_KEY` y `EMAIL_FROM` (p. ej. `CareCircle <hola@tudominio.com>`).

## 3. Edge Function de emails y limpieza de documentos
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU-REF
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="CareCircle <hola@tudominio.com>" CRON_SECRET="<secreto-aleatorio>"
supabase functions deploy notify-email
```
Prográmala cada 5 min: Dashboard → Edge Functions → notify-email → Schedules
→ cron `*/5 * * * *`. El programador debe enviar el mismo secreto en
la cabecera `x-cron-secret` y cumplir también la autenticación del proyecto.

Aplica `0017_reconcile_abandoned_document_uploads.sql` antes de desplegar la
función actualizada. El mismo trabajo programado limpia hasta 50 archivos por
ejecución del almacén de documentos cuando llevan al menos 24 horas sin ficha.
La limpieza se ejecuta antes del envío de correos.

Antes de activar `0018_require_validated_document_content.sql`, despliega
`validate-document` en el mismo proyecto. Publica después la versión de la
aplicación que lo invoca. La migración exige una validación para las nuevas fichas de documentos.


## 4. Vercel (frontend)
1. Sube el repo a GitHub e importa en https://vercel.com.
2. Variables de entorno (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://tu-dominio.com`
   - `RESEND_API_KEY`, `EMAIL_FROM` (para el email de invitación)
3. Settings → Functions → Region: **Frankfurt (fra1)** (datos en la UE).
4. Deploy, conecta tu dominio y actualiza la Site URL de Supabase (paso 1.5).

## 5. Checklist post-deploy (smoke test)
- [ ] Registro + confirmación de email + login con Google
- [ ] Crear círculo → pantalla de bienvenida → añadir medicación
- [ ] Copiar enlace de invitación → abrirlo en incógnito → unirse como Cuidador/a
- [ ] Marcar una toma desde la cuenta invitada → aparece "Registrada por…"
- [ ] Dejar una toma sin marcar 45 min → llega la notificación (campana)
- [ ] Subir documento sensible → comprobar que el rol Lector/a no puede ver ni descargar el archivo
- [ ] Instalar la PWA en un Android real (menú → Añadir a pantalla de inicio)
- [ ] Modo avión → la app muestra la página sin conexión

## 6. Antes del lanzamiento público
- Textos legales reales (privacidad art. 9 GDPR, términos, subencargados:
  Supabase, Vercel, Resend) revisados por abogado.
- Analytics: PostHog EU-hosted o Plausible.
- Piloto de validación con 5 familias (plan §12) antes de abrir lista de espera.
