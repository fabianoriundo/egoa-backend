// back/api/admission.ts
// Guarda el formulario de admisión en Neon y envía email de notificación.

import { db } from '../db';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'operaciones@egoa.app'; // ← email donde llegan las solicitudes

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const data = req.body;

  try {
    // ── 1. Guardar en base de datos ───────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO admissions (
        email, nombre, fecha_nacimiento, dni, nacionalidad, direccion, ciudad, celular,
        estado_civil, sociedad_ganancias, partida_registral,
        conyuge_nombre, conyuge_dni, conyuge_nacionalidad,
        ocupacion, empresa, cargo, rubro, antiguedad,
        otra_fuente, otra_fuente_detalle,
        rango_ingresos, patrimonio_liquido, forma_inversion,
        es_propietario, tipos_propiedades, tiene_segunda_propiedad, reto_principal,
        tipo_interes, frecuencia_uso, prioridad_inversion,
        rango_inversion_egoa, horizonte_tiempo, origen_fondos, declara_origen_licito,
        forma_pago, fuente_financiamiento, tiene_garantia, tipo_inmueble_garantia,
        ciudad_garantia, valor_garantia_usd, encaje_efectivo_usd, porcentaje_encaje,
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
        ${data.esPropietario ?? null},
        ${Array.isArray(data.tiposPropiedades) ? data.tiposPropiedades.join(', ') : null},
        ${data.tieneSegundaPropiedad ?? null},
        ${data.retoPrincipal ?? null},
        ${Array.isArray(data.tipoInteres) ? data.tipoInteres.join(', ') : null},
        ${data.frecuenciaUso ?? null},
        ${Array.isArray(data.prioridadInversion) ? data.prioridadInversion.join(', ') : null},
        ${data.rangoInversionEgoa ?? null},
        ${data.horizonteTiempo ?? null},
        ${data.origenFondos ?? null},
        ${data.declaraOrigenLicito ?? null},
        ${data.formaPago ?? null},
        ${data.fuenteFinanciamiento ?? null},
        ${data.tieneGarantia ?? null},
        ${data.tipoInmuebleGarantia ?? null},
        ${data.ciudadGarantia ?? null},
        ${data.valorGarantiaUSD ?? null},
        ${data.encajeEfectivoUSD ?? null},
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

    // ── 2. Enviar email de notificación ───────────────────────────────────────
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const nombre = data.nombre || data.nombreSolicitante || data.email || 'Sin nombre';

      // Email al equipo EGOA
      await transporter.sendMail({
        from: `"EGOA App" <${process.env.SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: `Nueva solicitud de admisión — ${nombre}`,
        html: buildAdminEmail(data, nombre),
      });

      // Email de confirmación al solicitante
      if (data.email) {
        await transporter.sendMail({
          from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
          to: data.email,
          subject: 'Recibimos tu solicitud de admisión · EGOA',
          html: buildUserEmail(nombre),
        });
      }
    } catch (emailError) {
      console.error('Email error (non-fatal):', emailError);
      // No falla el endpoint si el email falla
    }

    res.status(200).json({ message: 'Solicitud recibida correctamente' });

  } catch (error) {
    console.error('Admission error:', error);
    res.status(500).json({ error: 'Error al guardar la solicitud', detail: String(error) });
  }
}

// ── Templates de email ────────────────────────────────────────────────────────

function buildAdminEmail(data: any, nombre: string): string {
  const field = (label: string, value: any) =>
    value ? `<tr><td style="padding:6px 12px;color:#6B7280;font-size:13px;width:40%">${label}</td><td style="padding:6px 12px;font-size:13px;font-weight:600;color:#111827">${value}</td></tr>` : '';

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff">
      <div style="background:#0F172A;padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px">eGOa Capital</h1>
        <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:13px">Nueva solicitud de admisión</p>
      </div>

      <div style="padding:28px 32px">
        <div style="background:#F0F9FF;border-left:4px solid #1E40AF;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:24px">
          <p style="margin:0;font-size:15px;font-weight:700;color:#1E3A8A">${nombre}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#1E40AF">${data.email || ''}</p>
        </div>

        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin:0 0 8px">Datos personales</h3>
        <table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:20px">
          ${field('DNI / Pasaporte', data.dni)}
          ${field('Nacionalidad', data.nacionalidad)}
          ${field('Ciudad', data.ciudad)}
          ${field('Celular', data.celular)}
          ${field('Estado civil', data.estadoCivil)}
        </table>

        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin:0 0 8px">Actividad profesional</h3>
        <table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:20px">
          ${field('Ocupación', data.ocupacion)}
          ${field('Empresa', data.empresa)}
          ${field('Cargo', data.cargo)}
          ${field('Antigüedad', data.antiguedad)}
        </table>

        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin:0 0 8px">Perfil económico</h3>
        <table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:20px">
          ${field('Ingresos mensuales', data.rangoIngresos)}
          ${field('Patrimonio líquido', data.patrimonioLiquido)}
          ${field('Forma de inversión', data.formaInversion)}
          ${field('Propietario de inmueble', data.esPropietario)}
        </table>

        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin:0 0 8px">Inversión EGOA</h3>
        <table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:20px">
          ${field('Rango de inversión', data.rangoInversionEgoa)}
          ${field('Horizonte de tiempo', data.horizonteTiempo)}
          ${field('Origen de fondos', data.origenFondos)}
          ${field('Forma de pago', data.formaPago)}
          ${field('Canal', data.comoConocioEgoa)}
          ${field('Es PEP', data.esPEP)}
        </table>

        <div style="background:#FEF3C7;border-radius:8px;padding:14px 16px;margin-top:8px">
          <p style="margin:0;font-size:12px;color:#92400E">
            <strong>Estado:</strong> Pendiente de revisión · Solicitud recibida el ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB">
        <p style="margin:0;font-size:11px;color:#9CA3AF">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app</p>
      </div>
    </div>
  `;
}

function buildUserEmail(nombre: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff">
      <div style="background:#0F172A;padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px">eGOa Capital</h1>
      </div>

      <div style="padding:32px">
        <h2 style="font-size:22px;color:#111827;margin:0 0 8px;letter-spacing:-0.5px">
          Hola ${nombre.split(' ')[0]}, recibimos tu solicitud 🎉
        </h2>
        <p style="font-size:15px;color:#6B7280;line-height:1.6;margin:0 0 24px">
          Tu solicitud de admisión a EGOA ha sido recibida exitosamente y está en revisión por nuestro equipo.
        </p>

        <div style="background:#F0FDF4;border-radius:12px;padding:20px;margin-bottom:24px">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#14532D;text-transform:uppercase;letter-spacing:0.5px">¿Qué sigue?</p>
          ${['✅ Tu solicitud está en cola de revisión.', '🔍 Nuestro equipo evaluará tu perfil en las próximas 48 horas hábiles.', '📧 Recibirás un correo con el resultado de la evaluación.', '🏠 Si eres aprobado, tendrás acceso completo a la plataforma EGOA.'].map(item =>
            `<p style="margin:0 0 8px;font-size:13px;color:#166534">${item}</p>`
          ).join('')}
        </div>

        <p style="font-size:13px;color:#9CA3AF;line-height:1.6">
          ¿Tienes alguna pregunta? Escríbenos a 
          <a href="mailto:operaciones@egoa.app" style="color:#1E40AF">operaciones@egoa.app</a>
        </p>
      </div>

      <div style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB">
        <p style="margin:0;font-size:11px;color:#9CA3AF">EGOA Capital S.A.C. · RUC 20613300997 · 958 540 663</p>
      </div>
    </div>
  `;
}