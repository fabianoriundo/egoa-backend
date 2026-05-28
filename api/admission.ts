// back/api/admission.ts
import { db } from '../db';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

const ADMIN_EMAIL = 'operaciones@egoa.app';
const YOUR_EMAIL = 'ofabianmisael@gmail.com';
const LOGO_URL = 'https://egoa-backend-fabians-projects-4888a274.vercel.app/logo.png';

// ─── Generar PDF con todos los datos ─────────────────────────────────────────
function generateAdmissionPDF(data: any, nombre: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Logo (opcional, si falla continúa)
    try {
      doc.image(LOGO_URL, 40, 30, { width: 80 });
    } catch (e) {}

    doc.fontSize(18).text('Solicitud de Admisión - EGOA Capital', 40, 100, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, 40, 130, { align: 'right' });
    doc.moveDown(2);

    // DATOS PERSONALES
    doc.fontSize(12).font('Helvetica-Bold').text('DATOS PERSONALES', 40, 170);
    doc.fontSize(10).font('Helvetica');
    let y = 190;
    const addLine = (label: string, value: any) => {
      if (value) doc.text(`${label}: ${value}`, 40, y);
      y += 15;
    };
    addLine('Nombre completo', data.nombre);
    addLine('Fecha de nacimiento', data.fechaNacimiento);
    addLine('DNI / Pasaporte', data.dni);
    addLine('Nacionalidad', data.nacionalidad);
    addLine('Dirección', data.direccion);
    addLine('Ciudad', data.ciudad);
    addLine('Celular', data.celular);
    addLine('Estado civil', data.estadoCivil);
    if (data.estadoCivil === 'casado') {
      addLine('Cónyuge', data.conyugeNombre);
      addLine('Fecha nacimiento cónyuge', data.conyugeFecha);
      addLine('DNI cónyuge', data.conyugeDni);
      addLine('Nacionalidad cónyuge', data.conyugeNacionalidad);
      addLine('Sociedad de ganancias', data.sociedadGanancias);
      addLine('Partida registral', data.partidaRegistral);
    }
    y += 5;

    // ACTIVIDAD PROFESIONAL
    doc.fontSize(12).font('Helvetica-Bold').text('ACTIVIDAD PROFESIONAL', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Ocupación', data.ocupacion);
    addLine('Empresa', data.empresa);
    addLine('Cargo', data.cargo);
    addLine('Rubro', data.rubro);
    addLine('Antigüedad', data.antiguedad);
    addLine('Otra fuente de ingresos', data.otraFuente === 'si' ? `Sí - ${data.otraFuenteDetalle || ''}` : 'No');
    y += 5;

    // PERFIL ECONÓMICO
    doc.fontSize(12).font('Helvetica-Bold').text('PERFIL ECONÓMICO', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Ingresos mensuales', data.rangoIngresos);
    addLine('Patrimonio líquido', data.patrimonioLiquido);
    addLine('Forma de inversión', data.formaInversion);
    if (data.formaInversion === 'otro') addLine('Especificar', data.formaInversionOtro);
    addLine('Propietario de inmueble', data.esPropietario === 'si' ? 'Sí' : 'No');
    if (data.esPropietario === 'si') addLine('Tipo de inmuebles', data.tiposPropiedades?.join(', '));
    addLine('¿Ha tenido segunda propiedad?', data.tieneSegundaPropiedad === 'si' ? `Sí - ${data.retoPrincipal || ''}` : 'No');
    y += 5;

    // INTERÉS EGOA
    doc.fontSize(12).font('Helvetica-Bold').text('INTERÉS EN COPROPIEDAD', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Tipo de interés', data.tipoInteres?.join(', '));
    if (data.tipoInteres?.includes('otro')) addLine('Otro tipo', data.tipoInteresOtro);
    addLine('Frecuencia de uso', data.frecuenciaUso);
    addLine('Prioridad de inversión', data.prioridadInversion?.join(', '));
    if (data.prioridadInversion?.includes('otro')) addLine('Otra prioridad', data.prioridadOtro);
    y += 5;

    // RANGO DE INVERSIÓN
    doc.fontSize(12).font('Helvetica-Bold').text('RANGO DE INVERSIÓN', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Rango a invertir', data.rangoInversionEgoa);
    addLine('Horizonte de tiempo', data.horizonteTiempo);
    addLine('Origen de fondos', data.origenFondos);
    if (data.origenFondos === 'otro') addLine('Otro origen', data.origenFondosOtro);
    addLine('Declaración origen lícito', data.declaraOrigenLicito === 'si' ? 'Aceptada' : 'No aceptada');
    y += 5;

    // FINANCIAMIENTO
    doc.fontSize(12).font('Helvetica-Bold').text('COMPRA Y FINANCIAMIENTO', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Forma de pago', data.formaPago);
    addLine('Requiere financiamiento adicional', data.requiereFinanciamiento === 'si' ? 'Sí' : 'No');
    if (data.requiereFinanciamiento === 'si') {
      addLine('Fuente de financiamiento', data.fuenteFinanciamiento);
      if (data.fuenteFinanciamiento === 'otro') addLine('Especificar', data.fuenteFinanciamientoOtro);
    }
    addLine('Tiene garantía hipotecaria', data.tieneGarantia === 'si' ? `Sí - ${data.tipoInmuebleGarantia || ''}, ${data.ciudadGarantia || ''}` : 'No');
    addLine('Encaje en efectivo USD', data.encajeEfectivoUSD ? `$${data.encajeEfectivoUSD}` : '');
    addLine('Encaje en efectivo Soles', data.encajeEfectivoSoles ? `S/ ${data.encajeEfectivoSoles}` : '');
    addLine('Porcentaje de encaje', data.porcentajeEncaje ? `${data.porcentajeEncaje}%` : '');
    addLine('¿Es PEP?', data.esPEP === 'si' ? `Sí - ${data.pepDetalle || ''}` : 'No');
    addLine('¿Cómo conoció EGOA?', data.comoConocioEgoa);
    y += 5;

    // DECLARACIÓN
    doc.fontSize(12).font('Helvetica-Bold').text('DECLARACIÓN', 40, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    addLine('Lugar y fecha', data.lugarFecha);
    addLine('Nombre del solicitante', data.nombreSolicitante);
    addLine('Acepta términos', data.aceptaDeclaracion === 'si' ? 'Sí' : 'No');

    doc.text('--- Fin del documento ---', 40, y + 30, { align: 'center' });
    doc.end();
  });
}

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
        ${data.email ?? null}, ${data.nombre ?? null}, ${data.fechaNacimiento ?? null},
        ${data.dni ?? null}, ${data.nacionalidad ?? null}, ${data.direccion ?? null},
        ${data.ciudad ?? null}, ${data.celular ?? null}, ${data.estadoCivil ?? null},
        ${data.sociedadGanancias ?? null}, ${data.partidaRegistral ?? null},
        ${data.conyugeNombre ?? null}, ${data.conyugeFecha ?? null}, ${data.conyugeDni ?? null},
        ${data.conyugeNacionalidad ?? null}, ${data.ocupacion ?? null}, ${data.empresa ?? null},
        ${data.cargo ?? null}, ${data.rubro ?? null}, ${data.antiguedad ?? null},
        ${data.otraFuente ?? null}, ${data.otraFuenteDetalle ?? null},
        ${data.rangoIngresos ?? null}, ${data.patrimonioLiquido ?? null},
        ${data.formaInversion ?? null}, ${data.formaInversionOtro ?? null},
        ${data.esPropietario ?? null}, ${Array.isArray(data.tiposPropiedades) ? data.tiposPropiedades.join(', ') : null},
        ${data.tieneSegundaPropiedad ?? null}, ${data.retoPrincipal ?? null},
        ${Array.isArray(data.tipoInteres) ? data.tipoInteres.join(', ') : null}, ${data.tipoInteresOtro ?? null},
        ${data.frecuenciaUso ?? null}, ${Array.isArray(data.prioridadInversion) ? data.prioridadInversion.join(', ') : null},
        ${data.prioridadOtro ?? null}, ${data.rangoInversionEgoa ?? null}, ${data.horizonteTiempo ?? null},
        ${data.origenFondos ?? null}, ${data.origenFondosOtro ?? null}, ${data.declaraOrigenLicito ?? null},
        ${data.formaPago ?? null}, ${data.requiereFinanciamiento ?? null}, ${data.fuenteFinanciamiento ?? null},
        ${data.fuenteFinanciamientoOtro ?? null}, ${data.tieneGarantia ?? null}, ${data.tipoInmuebleGarantia ?? null},
        ${data.ciudadGarantia ?? null}, ${data.valorGarantiaUSD ?? null}, ${data.valorGarantiaSoles ?? null},
        ${data.situacionRegistral ?? null}, ${data.situacionRegistralDetalle ?? null},
        ${data.encajeEfectivoUSD ?? null}, ${data.encajeEfectivoSoles ?? null}, ${data.porcentajeEncaje ?? null},
        ${data.esPEP ?? null}, ${data.pepDetalle ?? null}, ${data.comoConocioEgoa ?? null},
        ${data.lugarFecha ?? null}, ${data.nombreSolicitante ?? null}, ${data.aceptaDeclaracion ?? null},
        'pendiente'
      )
    `);

    // ── 2. Configurar transporter ─────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const nombre = data.nombre || data.nombreSolicitante || 'Inversor';
    const userEmail = data.email;

    // ── 3. Generar PDF ───────────────────────────────────────────────────────
    const pdfBuffer = await generateAdmissionPDF(data, nombre);

    // ── 4. Correo al administrador + BCC (mensaje breve + PDF adjunto) ───────
    await transporter.sendMail({
      from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      bcc: YOUR_EMAIL,
      subject: `Nueva solicitud de admisión - ${nombre}`,
      html: buildAdminShortEmail(nombre),
      attachments: [
        {
          filename: `solicitud_${nombre.replace(/\s/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // ── 5. Correo al usuario (mensaje breve + PDF adjunto) ────────────────────
    if (userEmail && userEmail.includes('@')) {
      await transporter.sendMail({
        from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: 'Tu solicitud de admisión ha sido recibida - EGOA',
        html: buildUserShortEmail(nombre),
        attachments: [
          {
            filename: `solicitud_${nombre.replace(/\s/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    }

    res.status(200).json({ message: 'Solicitud recibida correctamente' });
  } catch (error) {
    console.error('Admission error:', error);
    res.status(500).json({ error: 'Error al guardar la solicitud', detail: String(error) });
  }
}

// ─── Correo breve para el administrador ───────────────────────────────────────
function buildAdminShortEmail(nombre: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:20px; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:500px; margin:0 auto; background:#ffffff; border-radius:28px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
        <div style="background:#0f172a; padding:24px 20px; text-align:center;">
          <img src="${LOGO_URL}" alt="EGOA Capital" style="max-width:120px; margin-bottom:10px;" />
          <h1 style="color:#ffffff; font-size:20px; margin:8px 0 0;">Nueva solicitud de admisión</h1>
          <p style="color:#94a3b8; margin:4px 0 0; font-size:13px;">Revisión pendiente</p>
        </div>
        <div style="padding:20px 24px 32px;">
          <div style="background:#f0f9ff; border-left:4px solid #1e40af; border-radius:12px; padding:14px 18px; margin-bottom:28px;">
            <p style="margin:0 0 4px; font-size:16px; font-weight:700; color:#1e3a8a;">${escapeHtml(nombre)}</p>
            <p style="margin:0; font-size:13px; color:#2563eb;">Adjunto encontrarás el PDF con toda la información.</p>
          </div>
          <div style="margin-top:32px; background:#fef9e3; border-radius:14px; padding:12px 16px; border:1px solid #fde68a;">
            <p style="margin:0; font-size:12px; color:#92400e;"><strong>📌 Estado:</strong> Pendiente de revisión · Recibida el ${new Date().toLocaleDateString('es-PE')}</p>
          </div>
        </div>
        <div style="background:#f9fafb; padding:14px 20px; text-align:center; border-top:1px solid #e5e7eb;">
          <p style="margin:0; font-size:11px; color:#9ca3af;">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─── Correo breve para el usuario ─────────────────────────────────────────────
function buildUserShortEmail(nombre: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:20px; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:500px; margin:0 auto; background:#ffffff; border-radius:28px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
        <div style="background:#0f172a; padding:24px 20px; text-align:center;">
          <img src="${LOGO_URL}" alt="EGOA Capital" style="max-width:110px;" />
          <h2 style="color:#fff; margin:12px 0 0; font-size:20px;">¡Solicitud recibida!</h2>
        </div>
        <div style="padding:24px 20px 32px;">
          <p style="font-size:16px; color:#111827;">Hola <strong>${escapeHtml(nombre.split(' ')[0])}</strong>,</p>
          <p style="font-size:15px; color:#4b5563; line-height:1.5;">Gracias por confiar en <strong>EGOA Capital</strong>.</p>
          <p style="font-size:15px; color:#4b5563; line-height:1.5;">Adjunto encontrarás el PDF con un resumen de tu solicitud. Nuestro equipo evaluará tu perfil en las próximas <strong>48 horas hábiles</strong> y te notificaremos el resultado.</p>
          <div style="background:#f0fdf4; border-radius:16px; padding:16px; margin:24px 0;">
            <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#14532d;">📌 ¿Qué sigue?</p>
            <p style="margin:0 0 6px; font-size:14px; color:#166534;">✅ Solicitud en cola de revisión</p>
            <p style="margin:0 0 6px; font-size:14px; color:#166534;">🔍 Evaluación de perfil por el comité EGOA</p>
            <p style="margin:0 0 6px; font-size:14px; color:#166534;">📧 Recibirás un correo con el resultado</p>
            <p style="margin:0; font-size:14px; color:#166534;">🏠 Acceso completo (si eres aprobado)</p>
          </div>
          <p style="font-size:13px; color:#6b7280;">¿Dudas? Escríbenos a <a href="mailto:operaciones@egoa.app" style="color:#1e40af;">operaciones@egoa.app</a>.</p>
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
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}