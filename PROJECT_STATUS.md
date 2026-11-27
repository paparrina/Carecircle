# CareCircle · Estado de la beta privada

Actualizado el 27 de noviembre de 2026. Rama de trabajo `carecircle-v2`. [Preview protegido](https://carecircle-git-carecircle-v2-trafficpanel.vercel.app). Supabase de pruebas `hwvsczwfxvvxyldvhqfh`. La preparación y las pruebas utilizan datos ficticios.

| Área | Estado |
| --- | --- |
| Formularios y familias | Se conservan entradas al corregir errores en formularios de autenticación, círculo, perfil, ubicación, medicación y agenda. Roles explicados en Miembros e invitaciones recientes con estados pendiente, aceptada y caducada. Las invitaciones revocadas se eliminan por el mecanismo existente. |
| Bienvenida | Crear círculo y persona cuidada en una operación, luego tutorial de cinco pasos. Se puede salir y volver desde Hoy. El progreso se calcula con los datos del círculo. |
| Mi cuenta | Preferencias personales de correo y push, descarga de perfil básico, pertenencias y preferencias, y acción de eliminación para cuentas sin círculo ni referencias compartidas. |
| Privacidad | El alta solicita una declaración de consentimiento o representación. Quedan por confirmar el responsable, el canal de privacidad, la conservación de datos y el proceso para retirar el consentimiento y gestionar datos compartidos. El documento público está marcado como borrador. |
| Push | Suscripción voluntaria por dispositivo, preferencia por cuenta, entrega genérica, expiración y reintentos. El servidor verifica el permiso del círculo antes de enviar. El clic abre Avisos. Se requieren pruebas reales en Android y una PWA instalada en iOS compatible. |
| Publicación | Migraciones `0021` y `0022` instaladas en CareCircle-pruebas. Emisor programado de pruebas y clave pública del Preview de `carecircle-v2` configurados. |

## Evidencia y límites

- Las cinco suites SQL pasan localmente y en CareCircle-pruebas. `private_beta_preferences.sql` comprueba preferencias aisladas, exclusión de correo, borrado limitado y reclamación/reintento sin duplicados.
- Las cinco pruebas Deno cubren el validador de archivos y el emisor push con respuestas de proveedor simuladas. TypeScript, ESLint, compilación y npm audit se verificaron con el código de beta.
- En un móvil emulado con datos ficticios se verificaron la conservación de campos tras un error, el tutorial recuperable, el estado de invitaciones, la descarga de cuenta, la exclusión de correo y la denegación del permiso push. La entrega real debe contrastarse en dispositivos físicos. La confirmación anterior de correo a Gmail sigue siendo evidencia de la ruta de correo existente. Push carece todavía de esa evidencia.
- La descarga autoservicio cubre la cuenta. La exportación más amplia y la gestión del borrado con contenido familiar compartido siguen sujetas a decisiones de privacidad.
- Google OAuth en pruebas y VoiceOver/TalkBack en móviles físicos permanecen pendientes.
