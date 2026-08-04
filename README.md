# CareCircle — MVP completo (Tareas 1–9)

PWA de coordinación familiar de cuidados de personas mayores.
**Cuidar juntos, aunque estemos lejos.**

## Qué incluye la Tarea 1
- Next.js 15 (App Router) + TypeScript estricto + Tailwind (design tokens de Cerca)
- Migración completa de Supabase: 17 tablas, funciones de rol, RLS en todo, bucket privado `documents`
- Auth: email+contraseña, magic link, Google OAuth, middleware de protección
- Flujo: registro → "¿A quién vas a cuidar?" → círculo creado → dashboard "Hoy"
- Shell: cabecera con persona cuidada, hoja de llamada rápida 📞 (tel:), línea de
  última ubicación + check-in 📍, campana, bottom nav de 5 secciones
- i18n ES/EN con next-intl (locale por cookie `NEXT_LOCALE`, `es` por defecto)
- Manifest PWA básico (service worker completo llega en T9)

## Puesta en marcha
1. **Supabase**: crea un proyecto en https://supabase.com (región UE, p. ej. Frankfurt).
2. En *SQL Editor*, ejecuta `supabase/migrations/0001_init.sql` completo.
   (O con CLI: `supabase db push`.)
3. En *Authentication → Providers*: activa **Email** (con confirmación) y **Google**
   (necesitas Client ID/Secret de Google Cloud; añade
   `https://TU-PROYECTO.supabase.co/auth/v1/callback` como redirect URI).
4. En *Authentication → URL Configuration*: Site URL = `http://localhost:3000`
   y añade `http://localhost:3000/auth/callback` a Redirect URLs.
5. Copia `.env.example` a `.env.local` y rellena las claves del proyecto.
6. Instala y arranca:
   ```bash
   npm install
   npm run dev
   ```

## Comprobación rápida (smoke test)
1. `/signup` → crea cuenta → confirma email → entra.
2. Te lleva a `/app/new` → escribe un nombre → marca el consentimiento → crear.
3. Aterrizas en el dashboard "Hoy" con estados vacíos.
4. Toca 📞 → aparecen Emergencias 112 (los contactos se añaden en el perfil, T2).
5. Toca 📍 “Marcar ubicación” → elige "En casa" → la cabecera muestra
   "En casa · ahora mismo (tu nombre)".

## Estructura
Ver árbol en `src/`. Los módulos Calendario, Meds, Docs, Muro, Perfil, Miembros,
Ajustes y Notificaciones muestran un placeholder con la tarea en la que se activan
(T2–T9 según el plan).

## Qué incluye la Tarea 2
- **Medicación end-to-end**: wizard de 3 pasos (nombre/dosis → horarios con chips
  Mañana/Mediodía/Noche + horas personalizadas + días de la semana → responsable),
  pestañas Hoy/Todos, detalle con adherencia de 7 días, editar/pausar/eliminar.
- **Registro de tomas**: "Marcar como dada" u "Omitir" con un toque, deshacer
  durante 10 s, y "Registrada por Rosa · 08:12" visible para toda la familia.
  Las tomas atrasadas se marcan en ámbar (nunca rojo).
- **Dashboard "Hoy" real**: la sección de medicación muestra las tomas del día.
- **Perfil de la persona cuidada**: datos básicos, teléfono, alergias, condiciones,
  notas, contactos de emergencia y médicos — que alimentan la hoja de llamada 📞.
  El rol "solo lectura" ve el perfil pero no lo edita.
- Migración `0002_meds_profile.sql`: teléfono del mayor + política para deshacer tomas.

**Importante**: ejecuta también `supabase/migrations/0002_meds_profile.sql` en el SQL Editor.

## Qué incluye la Tarea 3/4 (Calendario)
- **Eventos**: crear/editar/eliminar con tipo (cita médica, visita, tarea, otro),
  fecha/hora nativas, lugar, notas, "¿quién se encarga?" y recordatorios
  (1 día / 1 hora antes, guardados para el motor de notificaciones de la T9).
- **Vista Agenda** (por defecto): lista cronológica agrupada por día con
  "Hoy" y "Mañana". **Vista Mes**: rejilla con puntos en los días con eventos
  y lista del día seleccionado debajo.
- **Detalle**: "Marcar como completado" como acción principal, edición y borrado
  solo para coordinador/miembro, y en citas médicas un bloque "¿Necesitas llamar?"
  con los teléfonos de los médicos del perfil.
- **Dashboard "Hoy"**: la sección de agenda ahora muestra los eventos reales del día.

## Qué incluye la Tarea 5 (Invitaciones y roles)
- **Invitar por enlace**: un toque crea la invitación y copia al portapapeles un
  mensaje listo para pegar en WhatsApp ("He creado un espacio para organizarnos
  con Carmen… Únete aquí: [enlace]").
- **Invitar por email**: se envía con Resend si `RESEND_API_KEY` está configurada
  (añádela junto a `EMAIL_FROM` en `.env.local`); si no, se crea la invitación y
  se copia el enlace para compartirlo a mano.
- **Página /invite/[token]**: muestra quién invita y a qué círculo (vía RPC
  `get_invitation_info`), pide crear cuenta o entrar si hace falta, y botón
  "Unirme al círculo".
- **Gestión de roles**: la persona coordinadora cambia roles con un selector
  (con explicación de cada rol), quita miembros con confirmación y anula
  invitaciones pendientes. El sistema nunca deja el círculo sin coordinador.
- El rol "solo lectura" se muestra como **"Cuidador/a (solo lectura)"** — el
  nombre que validaremos en el piloto.
- Migración `0003_invitations.sql` (ejecútala en el SQL Editor).

**Variables nuevas en `.env.local` (opcionales):**
```
RESEND_API_KEY=re_...
EMAIL_FROM="CareCircle <hola@tudominio.com>"
```

## Qué incluye la Tarea 6 (Documentos)
- **Subida directa a Storage privado** desde el navegador (path
  `circles/{circleId}/{uuid}-nombre`, máx. 20 MB), con cámara o archivos,
  elección de carpeta y toggle "Documento sensible 🔒" con su explicación.
- **Carpetas**: las 6 predefinidas al crear el círculo + crear nuevas;
  chips horizontales con "Todas" y buscador por nombre.
- **Apertura con URL firmada temporal** (60 s si es sensible, 5 min si no):
  la visibilidad la decide la RLS de `documents`, así que el rol
  "Cuidador/a (solo lectura)" ni siquiera ve las filas sensibles.
- **Borrado** (solo coordinador/miembro) con confirmación: elimina la fila
  y el objeto de Storage.

## Qué incluye la Tarea 7 (Muro familiar)
- **Publicar**: texto + hasta 4 fotos (subidas al Storage privado bajo
  `circles/{id}/wall/`) y menciones @ con selector de miembros; las menciones
  se guardan en `mentions[]` (la notificación llega con la T9) y se resaltan
  en el texto.
- **Comentarios**: colapsados ("Ver 3 comentarios"), input inline, borrar los
  propios; el coordinador puede moderar (borrar posts/comentarios de otros).
- **Eventos del sistema intercalados** con estilo discreto: "📄 Marta subió
  *Análisis julio*", "👤 Javier se unió al círculo", "📍 Rosa marcó: En casa".
- **Sin likes** (decisión de diseño: menos ruido); el rol solo-lectura lee
  pero no publica.
- **Dashboard "Hoy"**: la tarjeta "Último en el muro" muestra el post real.

## Qué incluye la Tarea 8 (Fechas importantes + historial de ubicación)
- **Fechas importantes** en el perfil: cumpleaños, aniversarios, caducidades
  (DNI, seguros, recetas) y otras. Tipo con iconos, "se repite cada año"
  (activado automáticamente para cumpleaños/aniversarios) y aviso 7d/1d
  (guardado en `remind_days_before` para el motor de la T9).
- **Cálculo de próxima ocurrencia**: las anuales muestran siempre la fecha
  que viene, ordenadas por proximidad, con badge "en X días / mañana / ¡Hoy!".
- **Dashboard**: las fechas a ≤7 días aparecen destacadas en ámbar dentro de
  la tarjeta de agenda ("🪪 Caduca el DNI — en 5 días").
- **Historial de ubicaciones** de los últimos 7 días en el perfil
  ("🏠 En casa (Rosa) · mar 08:12").

## Qué incluye la Tarea 9 (Notificaciones + PWA)
- **Centro de notificaciones** (campana con badge de no leídas): recordatorios,
  tomas sin registrar, fechas importantes, posts, comentarios, menciones,
  documentos y nuevas incorporaciones. Se marcan leídas al abrir.
- **Triggers instantáneos en BD** (migración `0004`): post → new_post/mention,
  comentario → aviso al autor, documento → miembros (sensibles solo a editores),
  nuevo miembro → todos. Idempotentes vía `dedup_key`.
- **Barrido programado** `run_notification_sweep()` cada 5 min con pg_cron:
  · recordatorios de eventos según `reminder_minutes` (24h/1h)
  · toma sin registrar a los **+45 min** → responsable; **+90 min** → escala
    también a coordinadores (⚠)
  · fechas importantes a las 09:00, según `remind_days_before` (7d/1d)
  Si pg_cron no está activo, la migración lo avisa: prográmalo en
  Database → Cron Jobs.
- **Email (Edge Function `notify-email`)**: envía por Resend las notificaciones
  críticas (recordatorio, toma perdida, mención, fecha importante) de la última
  hora que aún no se hayan emailado. Despliégala con
  `supabase functions deploy notify-email` y prográmala cada 5 min
  (Edge Functions → Schedules). Secrets: `RESEND_API_KEY`, `EMAIL_FROM`.
- **PWA instalable**: service worker (estáticos cache-first, navegación con
  fallback a `/offline.html`), manifest con iconos reales. Web Push queda
  preparado (tabla `push_subscriptions`) para post-MVP.

**Ejecuta la migración `0004_notifications.sql` en el SQL Editor.**

## Estado del MVP
✅ T1 Base + auth + shell (llamada rápida 📞, check-in 📍)
✅ T2 Medicación end-to-end + perfil
✅ T3/4 Calendario (agenda/mes, asignación, completar)
✅ T5 Invitaciones (enlace WhatsApp + email) y roles
✅ T6 Documentos (Storage privado, carpetas, sensibles)
✅ T7 Muro (fotos, comentarios, menciones, eventos de sistema)
✅ T8 Fechas importantes + historial de ubicación
✅ T9 Notificaciones (triggers + pg_cron + Resend) + PWA

Pendiente post-MVP: onboarding guiado con checklist (T10 del plan), Web Push,
resumen semanal, exportación GDPR, textos legales definitivos.
