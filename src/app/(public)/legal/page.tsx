/* Página legal de CareCircle: privacidad + cookies + términos.
   PLANTILLA seria adaptada a la app. Antes del lanzamiento comercial,
   revísala con un abogado y rellena los datos del responsable. */

const UPDATED = "Agosto 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold text-ink">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-[17px] font-semibold text-ink">{children}</h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[16px] leading-relaxed text-ink-secondary">
      {children}
    </p>
  );
}

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-ink">
        Privacidad, cookies y condiciones de uso
      </h1>
      <p className="mt-2 text-[15px] text-ink-secondary">
        Última actualización: {UPDATED}
      </p>

      <section
        id="resumen"
        className="mt-8 rounded-lg border border-line bg-surface p-5"
      >
        <h2 className="text-lg font-semibold text-ink">
          En resumen (versión humana)
        </h2>
        <P>
          CareCircle existe para que tu familia se organice, no para explotar
          tus datos. Los datos de la persona que cuidáis solo los ve su
          círculo. Todo se guarda cifrado en servidores de la Unión Europea.
          No vendemos datos, no hay publicidad y no usamos cookies de rastreo
          — por eso no verás banner de cookies. Puedes exportar o borrar todo
          cuando quieras.
        </P>
      </section>

      <H2>1. Política de privacidad</H2>

      <H3>1.1 Responsable del tratamiento</H3>
      <P>
        [NOMBRE Y APELLIDOS / RAZÓN SOCIAL], con domicilio en [DIRECCIÓN] y
        correo de contacto para privacidad:{" "}
        <a
          className="text-primary underline"
          href="mailto:privacidad@ejemplo.com"
        >
          privacidad@ejemplo.com
        </a>
        .
      </P>

      <H3>1.2 Qué datos tratamos</H3>
      <P>
        <b>De los usuarios del círculo:</b> nombre, correo electrónico,
        teléfono (opcional), idioma y actividad dentro de la app (por ejemplo,
        quién registró una toma o subió un documento).
      </P>
      <P>
        <b>De la persona cuidada:</b> nombre, fecha de nacimiento, teléfono y
        contactos, y los datos de salud que el círculo decida introducir:
        medicación, alergias, condiciones, citas médicas, documentos e
        indicaciones de ubicación registradas manualmente por sus cuidadores.
        Los datos de salud son datos de categoría especial (art. 9 RGPD) y los
        tratamos con garantías reforzadas.
      </P>

      <H3>1.3 Base legal y consentimiento de la persona cuidada</H3>
      <P>
        Tratamos los datos sobre la base del consentimiento explícito (art.
        6.1.a y 9.2.a RGPD) y de la prestación del servicio que nos pides. Al
        crear un círculo, quien lo crea declara contar con el consentimiento
        de la persona cuidada o actuar como su representante. Esa persona (o
        su representante) puede ejercer en cualquier momento los derechos del
        punto 1.7, incluida la retirada del consentimiento y la eliminación
        de todos sus datos.
      </P>

      <H3>1.4 Para qué NO usamos tus datos</H3>
      <P>
        No los vendemos ni cedemos a terceros con fines comerciales. No hay
        publicidad ni perfilado publicitario. No se usan para entrenar
        sistemas de inteligencia artificial. Nadie ajeno a tu círculo puede
        ver la información: el acceso se controla fila a fila en la propia
        base de datos (Row Level Security) según el rol de cada miembro.
      </P>

      <H3>1.5 Dónde se guardan y quién nos ayuda a prestar el servicio</H3>
      <P>
        Los datos se alojan cifrados en la Unión Europea. Encargados del
        tratamiento con contrato de encargo (DPA): Supabase (base de datos y
        archivos, región Fráncfort, Alemania), Vercel (infraestructura web,
        funciones en la UE), Resend (envío de correos transaccionales como
        invitaciones y avisos) y, si eliges iniciar sesión con Google, Google
        Ireland Ltd. como proveedor de identidad. Los documentos se sirven
        mediante enlaces firmados de corta duración, y los marcados como
        sensibles solo son visibles para los roles autorizados del círculo.
      </P>

      <H3>1.6 Cuánto tiempo conservamos los datos</H3>
      <P>
        Mientras el círculo exista. Si eliminas un documento, una publicación
        o un círculo completo, se borra de forma efectiva de nuestros
        sistemas en un plazo máximo de 30 días (incluidas copias de
        seguridad). Si eliminas tu cuenta, desaparecen tus datos personales;
        el contenido esencial del círculo puede conservarse para el resto de
        la familia si así lo decide la persona coordinadora.
      </P>

      <H3>1.7 Tus derechos</H3>
      <P>
        Acceso, rectificación, supresión, oposición, limitación y
        portabilidad: escríbenos al correo de privacidad y responderemos en
        un máximo de 30 días. Puedes pedir una copia exportada de los datos
        del círculo. Si crees que no lo hacemos bien, puedes reclamar ante la
        Agencia Española de Protección de Datos (aepd.es).
      </P>

      <H3>1.8 Seguridad</H3>
      <P>
        Cifrado en tránsito (TLS) y en reposo, control de acceso por roles
        aplicado en la propia base de datos, registro de quién realiza cada
        acción y enlaces temporales para los archivos. Ningún sistema es
        infalible: si detectáramos una brecha que afecte a tus datos, te lo
        notificaríamos conforme al RGPD.
      </P>

      <H2>2. Cookies</H2>
      <P>
        Usamos únicamente cookies técnicas estrictamente necesarias: las de
        sesión de autenticación (para mantenerte dentro con seguridad) y una
        cookie de preferencia de idioma. Estas cookies están exentas del
        deber de consentimiento según la normativa vigente, y por eso no
        mostramos banner de cookies. No usamos cookies de análisis,
        publicidad ni rastreo de terceros. Si esto cambiara algún día,
        actualizaríamos esta política y te pediríamos consentimiento antes.
      </P>

      <H2>3. Condiciones de uso</H2>

      <H3>3.1 Qué es CareCircle (y qué no es)</H3>
      <P>
        CareCircle es una herramienta de organización familiar. No es un
        producto sanitario, no ofrece consejo médico y no sustituye a
        profesionales de la salud ni a servicios de emergencia. Los
        recordatorios son una ayuda y pueden fallar o retrasarse: la
        responsabilidad sobre la medicación y el cuidado corresponde siempre
        a las personas cuidadoras. En una emergencia, llama al 112.
      </P>

      <H3>3.2 Tu cuenta y el contenido que subes</H3>
      <P>
        Eres responsable de la veracidad de los datos que introduces, de
        contar con el consentimiento de la persona cuidada y de quienes
        aparezcan en las fotos o documentos que subas, y de invitar al
        círculo solo a personas de confianza. No está permitido usar la app
        para fines ilícitos ni subir contenido que vulnere derechos de
        terceros. Quien coordina el círculo puede retirar miembros y moderar
        contenido.
      </P>

      <H3>3.3 Disponibilidad y cambios</H3>
      <P>
        Prestamos el servicio "tal cual", con la máxima diligencia pero sin
        garantía de disponibilidad ininterrumpida. Podemos actualizar la app
        y estas condiciones; si el cambio es relevante, te avisaremos dentro
        de la aplicación. Puedes dejar de usar el servicio y borrar tus datos
        en cualquier momento.
      </P>

      <H3>3.4 Ley aplicable</H3>
      <P>
        Legislación española y, para consumidores, los juzgados de tu
        domicilio.
      </P>

      <p className="mt-12 rounded-md bg-warning-soft p-4 text-[14px] leading-relaxed text-ink">
        ⚠️ Nota interna: este texto es una plantilla adaptada a CareCircle
        para la fase de piloto. Antes del lanzamiento comercial, hazla
        revisar por un profesional y completa los datos del responsable
        (punto 1.1). Elimina este aviso al hacerlo.
      </p>
    </main>
  );
}
