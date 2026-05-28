import { db } from '../db';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'operaciones@egoa.app';
const YOUR_EMAIL = 'ofabianmisael@gmail.com'; // <- tu correo para copia
// Logo público (cámbialo por tu URL real)
const LOGO_URL = 'https://imgur.com/a/K7hu9TM';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const data = req.body;

  try {
    // ── 1. Guardar en base de datos (INSERT completo) ─────────────────────────
    await db.execute(sql`
      INSERT INTO admissions (
        email, nombre, fecha_nacimiento, dni, nacionalidad, direccion, ciudad, celular,
        estado_civil, sociedad_ganancias, partida_registral,
        conyuge_nombre, conyuge_fecha_nacimiento, conyuge_dni, conyuge_nacionalidad,
        ocupacion, empresa, cargo, rubro, antiguedad,
        otra_fuente, otra_fuente_detalle,
        rango_ingresos, patrimonio_liquido, forma_inversion, forma_inversion_otro,
        es_propietario, tipos_propiedades, tiene_segunda_propiedad, reto_principal,
        tipo_interes, tipo_interes_otro, frecuencia_uso, prioridad_inversion, prioridad_otro,
        rango_inversion_egoa, horizonte_tiempo, origen_fondos, origen_fondos_otro, declara_origen_licito,
        forma_pago, requiere_financiamiento, fuente_financiamiento, fuente_financiamiento_otro,
        tiene_garantia, tipo_inmueble_garantia, ciudad_garantia,
        valor_garantia_usd, valor_garantia_soles, situacion_registral, situacion_registral_detalle,
        encaje_efectivo_usd, encaje_efectivo_soles, porcentaje_encaje,
        es_pep, pep_detalle, como_conocio_egoa,
        lugar_fecha, nombre_solicitante, acepta_declaracion,
        status
      ) VALUES (
        ${data.email ?? null},
        ${data.nombre ?? null},
        ${data.fechaNacimiento ?? null},
        ${data.dni ?? null},
        ${data.nacionalidad ?? null},
        ${data.direccion ?? null},
        ${data.ciudad ?? null},
        ${data.celular ?? null},
        ${data.estadoCivil ?? null},
        ${data.sociedadGanancias ?? null},
        ${data.partidaRegistral ?? null},
        ${data.conyugeNombre ?? null},
        ${data.conyugeFecha ?? null},
        ${data.conyugeDni ?? null},
        ${data.conyugeNacionalidad ?? null},
        ${data.ocupacion ?? null},
        ${data.empresa ?? null},
        ${data.cargo ?? null},
        ${data.rubro ?? null},
        ${data.antiguedad ?? null},
        ${data.otraFuente ?? null},
        ${data.otraFuenteDetalle ?? null},
        ${data.rangoIngresos ?? null},
        ${data.patrimonioLiquido ?? null},
        ${data.formaInversion ?? null},
        ${data.formaInversionOtro ?? null},
        ${data.esPropietario ?? null},
        ${Array.isArray(data.tiposPropiedades) ? data.tiposPropiedades.join(', ') : null},
        ${data.tieneSegundaPropiedad ?? null},
        ${data.retoPrincipal ?? null},
        ${Array.isArray(data.tipoInteres) ? data.tipoInteres.join(', ') : null},
        ${data.tipoInteresOtro ?? null},
        ${data.frecuenciaUso ?? null},
        ${Array.isArray(data.prioridadInversion) ? data.prioridadInversion.join(', ') : null},
        ${data.prioridadOtro ?? null},
        ${data.rangoInversionEgoa ?? null},
        ${data.horizonteTiempo ?? null},
        ${data.origenFondos ?? null},
        ${data.origenFondosOtro ?? null},
        ${data.declaraOrigenLicito ?? null},
        ${data.formaPago ?? null},
        ${data.requiereFinanciamiento ?? null},
        ${data.fuenteFinanciamiento ?? null},
        ${data.fuenteFinanciamientoOtro ?? null},
        ${data.tieneGarantia ?? null},
        ${data.tipoInmuebleGarantia ?? null},
        ${data.ciudadGarantia ?? null},
        ${data.valorGarantiaUSD ?? null},
        ${data.valorGarantiaSoles ?? null},
        ${data.situacionRegistral ?? null},
        ${data.situacionRegistralDetalle ?? null},
        ${data.encajeEfectivoUSD ?? null},
        ${data.encajeEfectivoSoles ?? null},
        ${data.porcentajeEncaje ?? null},
        ${data.esPEP ?? null},
        ${data.pepDetalle ?? null},
        ${data.comoConocioEgoa ?? null},
        ${data.lugarFecha ?? null},
        ${data.nombreSolicitante ?? null},
        ${data.aceptaDeclaracion ?? null},
        'pendiente'
      )
    `);

    // ── 2. Configurar transporter con las variables correctas ─────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTPS_HOST,    // <- corregido
      port: parseInt(process.env.SMTPS_PORT || '587'),
      secure: process.env.SMTPS_PORT === '465', // true para 465, false para otros
      auth: {
        user: process.env.SMTPS_USER,
        pass: process.env.SMTPS_PASS,
      },
    });

    const nombre = data.nombre || data.nombreSolicitante || 'Inversor';
    const userEmail = data.email;

    // ── 3. Correo al administrador (y a ti por BCC) ─────────────────────────
    const adminHtml = buildAdminEmail(data, nombre);
    await transporter.sendMail({
      from: `"EGOA App" <${process.env.SMTPS_USER}>`,
      to: ADMIN_EMAIL,
      bcc: YOUR_EMAIL,   // <- te llega copia oculta a ti
      subject: `Nueva solicitud de admisión — ${nombre}`,
      html: adminHtml,
    });

    // ── 4. Correo de confirmación al usuario ─────────────────────────────────
    if (userEmail && userEmail.includes('@')) {
      const userHtml = buildUserEmail(nombre);
      await transporter.sendMail({
        from: `"EGOA Capital" <${process.env.SMTPS_USER}>`,
        to: userEmail,
        subject: '✅ Recibimos tu solicitud de admisión · EGOA',
        html: userHtml,
      });
    } else {
      console.warn('Correo de usuario no válido, no se envió confirmación:', userEmail);
    }

    res.status(200).json({ message: 'Solicitud recibida correctamente' });
  } catch (error) {
    console.error('Admission error:', error);
    res.status(500).json({ error: 'Error al guardar la solicitud', detail: String(error) });
  }
}

// ---------- CORREO ADMIN (con TODOS los datos, diseño mejorado) ----------
function buildAdminEmail(data: any, nombre: string): string {
  const field = (label: string, value: any, highlight = false) => {
    if (!value || value === '') return '';
    const displayValue = Array.isArray(value) ? value.join(', ') : value;
    return `<tr>
      <td style="padding:10px 14px; background:#fff; border-bottom:1px solid #eef2f6; font-size:13px; color:#4b5563; width:35%">${escapeHtml(label)}</td>
      <td style="padding:10px 14px; background:#fff; border-bottom:1px solid #eef2f6; font-size:13px; font-weight:${highlight ? '700' : '500'}; color:${highlight ? '#1e40af' : '#111827'}">${escapeHtml(displayValue)}</td>
    </tr>`;
  };

  const section = (title: string, rows: string) => `
    <div style="margin-top:28px; margin-bottom:12px;">
      <div style="display:inline-block; background:#1e40af; width:4px; height:18px; border-radius:2px; margin-right:10px; vertical-align:middle;"></div>
      <h3 style="display:inline-block; font-size:15px; font-weight:700; color:#1f2937; margin:0;">${title}</h3>
    </div>
    <table style="width:100%; border-collapse:collapse; border-radius:16px; overflow:hidden; background:#fafbfc;">${rows}</table>
  `;

  let personalRows = `
    ${field('Nombre completo', data.nombre, true)}
    ${field('Fecha de nacimiento', data.fechaNacimiento)}
    ${field('DNI / Pasaporte', data.dni)}
    ${field('Nacionalidad', data.nacionalidad)}
    ${field('Dirección', data.direccion)}
    ${field('Ciudad', data.ciudad)}
    ${field('Celular', data.celular)}
    ${field('Estado civil', data.estadoCivil)}
  `;

  let conyugeRows = '';
  if (data.estadoCivil === 'casado') {
    conyugeRows = section('👫 Datos del cónyuge', `
      ${field('Nombre cónyuge', data.conyugeNombre)}
      ${field('Fecha nacimiento', data.conyugeFecha)}
      ${field('DNI cónyuge', data.conyugeDni)}
      ${field('Nacionalidad', data.conyugeNacionalidad)}
      ${field('Sociedad de ganancias', data.sociedadGanancias)}
      ${field('Partida registral', data.partidaRegistral)}
    `);
  }

  let profesionalRows = `
    ${field('Ocupación', data.ocupacion, true)}
    ${field('Empresa', data.empresa)}
    ${field('Cargo', data.cargo)}
    ${field('Rubro', data.rubro)}
    ${field('Antigüedad', data.antiguedad)}
    ${field('Otra fuente de ingresos', data.otraFuente === 'si' ? `Sí — ${data.otraFuenteDetalle || ''}` : 'No')}
  `;

  let economicoRows = `
    ${field('Ingresos mensuales', data.rangoIngresos, true)}
    ${field('Patrimonio líquido', data.patrimonioLiquido, true)}
    ${field('Forma de inversión', data.formaInversion)}
    ${data.formaInversion === 'otro' ? field('Especificar', data.formaInversionOtro) : ''}
    ${field('Propietario de inmueble', data.esPropietario === 'si' ? 'Sí' : 'No')}
    ${data.esPropietario === 'si' ? field('Tipo de inmuebles', data.tiposPropiedades) : ''}
    ${field('¿Ha tenido segunda propiedad?', data.tieneSegundaPropiedad === 'si' ? `Sí — ${data.retoPrincipal || ''}` : 'No')}
  `;

  let interesRows = `
    ${field('Tipo de interés', data.tipoInteres)}
    ${data.tipoInteres?.includes('otro') ? field('Otro tipo', data.tipoInteresOtro) : ''}
    ${field('Frecuencia de uso', data.frecuenciaUso)}
    ${field('Prioridad de inversión', data.prioridadInversion)}
    ${data.prioridadInversion?.includes('otro') ? field('Otra prioridad', data.prioridadOtro) : ''}
  `;

  let inversionRows = `
    ${field('Rango a invertir', data.rangoInversionEgoa, true)}
    ${field('Horizonte de tiempo', data.horizonteTiempo, true)}
    ${field('Origen de fondos', data.origenFondos)}
    ${data.origenFondos === 'otro' ? field('Otro origen', data.origenFondosOtro) : ''}
    ${field('Declaración origen lícito', data.declaraOrigenLicito === 'si' ? '✅ Aceptada' : '❌ No aceptada', true)}
  `;

  let financiamientoRows = `
    ${field('Forma de pago', data.formaPago)}
    ${field('Requiere financiamiento adicional', data.requiereFinanciamiento === 'si' ? 'Sí' : 'No')}
    ${data.requiereFinanciamiento === 'si' ? field('Fuente de financiamiento', data.fuenteFinanciamiento) : ''}
    ${data.fuenteFinanciamiento === 'otro' ? field('Especificar fuente', data.fuenteFinanciamientoOtro) : ''}
    ${field('Tiene garantía hipotecaria', data.tieneGarantia === 'si' ? `Sí — ${data.tipoInmuebleGarantia || ''}, ${data.ciudadGarantia || ''}` : 'No')}
    ${field('Encaje en efectivo USD', data.encajeEfectivoUSD ? `$${data.encajeEfectivoUSD}` : '')}
    ${field('Encaje en efectivo Soles', data.encajeEfectivoSoles ? `S/ ${data.encajeEfectivoSoles}` : '')}
    ${field('Porcentaje de encaje', data.porcentajeEncaje ? `${data.porcentajeEncaje}%` : '')}
    ${field('¿Es PEP?', data.esPEP === 'si' ? `Sí — ${data.pepDetalle || ''}` : 'No')}
    ${field('¿Cómo conoció EGOA?', data.comoConocioEgoa)}
  `;

  let declaracionRows = `
    ${field('Lugar y fecha', data.lugarFecha)}
    ${field('Nombre del solicitante', data.nombreSolicitante)}
    ${field('Acepta términos', data.aceptaDeclaracion === 'si' ? '✅ Sí' : '❌ No', true)}
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0; padding:0; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:680px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
        <div style="background:#0f172a; padding:28px 32px; text-align:center;">
          <img src="${LOGO_URL}" alt="EGOA Capital" style="max-width:140px; margin-bottom:12px;" />
          <h1 style="color:#ffffff; font-size:22px; margin:12px 0 0; font-weight:600;">Nueva solicitud de admisión</h1>
          <p style="color:#94a3b8; margin:4px 0 0;">Revisión pendiente</p>
        </div>
        <div style="padding:24px 32px 40px;">
          <div style="background:#f0f9ff; border-left:4px solid #1e40af; border-radius:12px; padding:16px 20px; margin-bottom:32px;">
            <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1e3a8a;">${escapeHtml(nombre)}</p>
            <p style="margin:0; font-size:13px; color:#2563eb;">${data.email || 'Sin email'}</p>
          </div>
          ${section('📋 Datos personales', personalRows)}
          ${conyugeRows}
          ${section('💼 Actividad profesional', profesionalRows)}
          ${section('📊 Perfil económico', economicoRows)}
          ${section('🏡 Interés en copropiedad', interesRows)}
          ${section('💰 Rango de inversión', inversionRows)}
          ${section('🏦 Financiamiento', financiamientoRows)}
          ${section('✍️ Declaración', declaracionRows)}
          <div style="margin-top:32px; background:#fef9e3; border-radius:14px; padding:14px 18px; border:1px solid #fde68a;">
            <p style="margin:0; font-size:12px; color:#92400e;"><strong>📌 Estado:</strong> Pendiente de revisión · Recibida el ${new Date().toLocaleDateString('es-PE')}</p>
          </div>
        </div>
        <div style="background:#f9fafb; padding:16px 32px; text-align:center; border-top:1px solid #e5e7eb;">
          <p style="margin:0; font-size:11px; color:#9ca3af;">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ---------- CORREO USUARIO (solo confirmación) ----------
function buildUserEmail(nombre: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0; padding:0; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
        <div style="background:#0f172a; padding:28px 32px; text-align:center;">
          <img src="${LOGO_URL}" alt="EGOA Capital" style="max-width:120px;" />
          <h2 style="color:#fff; margin:16px 0 0; font-size:20px;">¡Tu solicitud ha sido recibida!</h2>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px; color:#111827;">Hola <strong>${escapeHtml(nombre.split(' ')[0])}</strong>,</p>
          <p style="font-size:15px; color:#4b5563; line-height:1.5;">Gracias por confiar en <strong>EGOA Capital</strong>. Hemos recibido tu solicitud de admisión correctamente y nuestro equipo la revisará en un plazo de <strong>48 horas hábiles</strong>.</p>
          <div style="background:#f0fdf4; border-radius:16px; padding:20px; margin:24px 0;">
            <p style="margin:0 0 12px; font-size:13px; font-weight:700; color:#14532d;">📌 ¿Qué sigue?</p>
            <p style="margin:0 0 8px; font-size:14px; color:#166534;">✅ Solicitud en cola de revisión</p>
            <p style="margin:0 0 8px; font-size:14px; color:#166534;">🔍 Evaluación de perfil por el comité EGOA</p>
            <p style="margin:0 0 8px; font-size:14px; color:#166534;">📧 Recibirás un correo con el resultado</p>
            <p style="margin:0; font-size:14px; color:#166534;">🏠 Acceso completo a la plataforma (si eres aprobado)</p>
          </div>
          <p style="font-size:13px; color:#6b7280;">Si tienes alguna duda, responde a este correo o escríbenos a <a href="mailto:operaciones@egoa.app" style="color:#1e40af;">operaciones@egoa.app</a>.</p>
          <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;" />
          <p style="font-size:11px; color:#9ca3af; text-align:center;">EGOA Capital S.A.C. · RUC 20613300997</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}