// back/api/admission.ts — v2
// PDF profesional + emails completos con todos los campos traducidos.

import { db } from '../db';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

const ADMIN_EMAIL  = 'operaciones@egoa.app';
const YOUR_EMAIL   = 'ofabianmisael@gmail.com';
const LOGO_URL     = 'https://egoa-backend-fabians-projects-4888a274.vercel.app/eGOa_logo.png';

// ─── Traducciones de valores clave ────────────────────────────────────────────
const T: Record<string, Record<string, string>> = {
  estadoCivil:        { soltero:'Soltero/a', casado:'Casado/a', divorciado:'Divorciado/a', viudo:'Viudo/a' },
  sociedadGanancias:  { si:'Sí', no:'No' },
  otraFuente:         { si:'Sí', no:'No' },
  esPropietario:      { si:'Sí', no:'No' },
  tieneSegundaPropiedad:{ si:'Sí', no:'No' },
  rangoIngresos:      { hasta5k:'Hasta US$ 5,000', '5k-10k':'US$ 5,001 – 10,000', '10k-20k':'US$ 10,001 – 20,000', mas20k:'Más de US$ 20,000' },
  patrimonioLiquido:  { hasta100k:'Hasta US$ 100,000', '100k-300k':'US$ 100,001 – 300,000', '300k-1m':'US$ 300,001 – 1,000,000', mas1m:'Más de US$ 1,000,000' },
  formaInversion:     { propios:'Recursos propios', venta:'Venta de otros activos', combinado:'Propios + financiamiento', otro:'Otro' },
  tiposPropiedades:   { vivienda:'Vivienda principal', dpto:'Departamento', playa:'Casa de playa', campo:'Casa de campo', terreno:'Terrenos', renta:'Inmuebles de renta' },
  tipoInteres:        { playa:'Casa de playa', campo:'Casa de campo', desierto:'Casa en desierto', otro:'Otro' },
  frecuenciaUso:      { esporadico:'Fines de semana esporádicos', temporadas:'Temporadas', escapadas:'Escapadas planificadas', indefinido:'Aún no lo tengo claro' },
  prioridadInversion: { lifestyle:'Estilo de vida / disfrute', capital:'Optimizar capital', plusvalia:'Plusvalía', diversificacion:'Diversificación de patrimonio', otro:'Otro' },
  rangoInversionEgoa: { hasta80k:'Hasta US$ 80,000', '80k-150k':'US$ 80,001 – 150,000', '150k-250k':'US$ 150,001 – 250,000', mas250k:'Más de US$ 250,000' },
  horizonteTiempo:    { '1-3':'01 a 03 años', '3-5':'03 a 05 años', mas5:'Más de 05 años', indefinido:'Aún no lo tengo claro' },
  origenFondos:       { profesional:'Ingresos profesionales / negocio', ahorros:'Ahorros acumulados', venta:'Venta de otros activos', herencia:'Herencia', otro:'Otro' },
  declaraOrigenLicito:{ si:'✓ Declaración aceptada', no:'No aceptada' },
  formaPago:          { contado:'Pago al contado – 100% recursos propios', combinado:'Pago combinado – recursos + financiamiento' },
  requiereFinanciamiento:{ si:'Sí', no:'No' },
  fuenteFinanciamiento:{ banco:'Financiamiento bancario', altera:'Altera Finance (socio EGOA)', otro:'Otro' },
  tieneGarantia:      { si:'Sí, cuenta con propiedad', no:'No cuenta con propiedad' },
  situacionRegistral: { limpio:'Sin cargas ni gravámenes', cargas:'Con cargas' },
  esPEP:              { si:'Sí – es PEP', no:'No es PEP' },
  comoConocioEgoa:    { redes:'Redes sociales', evento:'Evento en el club / Stand', referido:'Referido', asesor:'Referido por asesor financiero / inmobiliario', aliado:'Cliente de Altera / Harvest / Grupo aliado', otro:'Otro' },
  aceptaDeclaracion:  { si:'✓ Declaración aceptada y firmada', no:'No aceptada' },
};

function t(field: string, value: any): string {
  if (!value || value === '' || (Array.isArray(value) && value.length === 0)) return '—';
  if (Array.isArray(value)) return value.map(v => T[field]?.[v] ?? v).join(' · ') || '—';
  return T[field]?.[value] ?? value;
}

function esc(str: any): string {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
}

// ─── Fetch logo como Buffer ───────────────────────────────────────────────────
async function fetchLogo(): Promise<Buffer | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ─── Generador PDF ────────────────────────────────────────────────────────────
async function generatePDF(data: any, nombre: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const logoBuffer = await fetchLogo();
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const bufs: Buffer[] = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const W = 595.28;
    const MARGIN = 36;
    const COL = W - MARGIN * 2;
    let y = 0;

    // ── Helpers ──────────────────────────────────────────────────────────────
    const checkBreak = (need: number) => {
      if (y + need > 800) {
        doc.addPage();
        y = MARGIN;
        drawMiniHeader();
      }
    };

    const drawMiniHeader = () => {
      doc.rect(0, 0, W, 28).fill('#0F172A');
      doc.fontSize(8).fillColor('#94A3B8').font('Helvetica')
         .text('EGOA Capital S.A.C. · Solicitud de Admisión · Confidencial', MARGIN, 10, { width: COL, align: 'center' });
      y = 38;
    };

    const section = (title: string, icon: string) => {
      checkBreak(38);
      doc.rect(MARGIN, y, COL, 24).fill('#1E40AF').roundedRect(MARGIN, y, COL, 24, 4).fill('#1E40AF');
      doc.fontSize(9.5).fillColor('#FFFFFF').font('Helvetica-Bold')
         .text(`${icon}  ${title.toUpperCase()}`, MARGIN + 12, y + 7, { width: COL - 24 });
      y += 32;
    };

    const field = (label: string, value: any, translated?: string) => {
      const val = translated ?? String(value ?? '');
      if (!val || val === '—') return;
      checkBreak(18);
      const rowBg = Math.floor(y / 18) % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      doc.rect(MARGIN, y, COL, 17).fill(rowBg);
      doc.rect(MARGIN, y + 16.5, COL, 0.5).fill('#E2E8F0');
      doc.fontSize(8.5).fillColor('#64748B').font('Helvetica')
         .text(label, MARGIN + 10, y + 4.5, { width: COL * 0.38 });
      doc.fontSize(8.5).fillColor('#0F172A').font('Helvetica-Bold')
         .text(val, MARGIN + COL * 0.4, y + 4.5, { width: COL * 0.58 });
      y += 17;
    };

    const gap = (n = 8) => { y += n; };

    // ── PORTADA / HEADER ─────────────────────────────────────────────────────
    // Fondo oscuro header
    doc.rect(0, 0, W, 120).fill('#0F172A');

    // Logo
    if (logoBuffer) {
      try { doc.image(logoBuffer, MARGIN, 18, { height: 40 }); } catch {}
    }

    // Título y fecha
    doc.fontSize(18).fillColor('#FFFFFF').font('Helvetica-Bold')
       .text('Solicitud de Admisión', 0, 22, { align: 'center', width: W });
    doc.fontSize(9).fillColor('#94A3B8').font('Helvetica')
       .text(`EGOA Capital S.A.C. · RUC 20613300997`, 0, 46, { align: 'center', width: W });

    // Caja azul con nombre del solicitante
    doc.rect(MARGIN, 72, COL, 34).fill('#1E3A8A');
    doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold')
       .text(nombre, MARGIN + 14, 79, { width: COL - 28 });
    doc.fontSize(8.5).fillColor('#93C5FD').font('Helvetica')
       .text(`${data.email ?? ''}  ·  ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })}`,
             MARGIN + 14, 94, { width: COL - 28 });

    y = 132;

    // ── DATOS PERSONALES ─────────────────────────────────────────────────────
    section('Datos Personales', '👤');
    field('Nombre completo', data.nombre);
    field('Fecha de nacimiento', data.fechaNacimiento);
    field('DNI / CE / Pasaporte', data.dni);
    field('Nacionalidad', data.nacionalidad);
    field('Dirección', data.direccion);
    field('Ciudad', data.ciudad);
    field('Celular', data.celular);
    field('Estado civil', data.estadoCivil, t('estadoCivil', data.estadoCivil));
    if (data.estadoCivil === 'casado') {
      field('Sociedad de ganancias', '', t('sociedadGanancias', data.sociedadGanancias));
      field('Nombre cónyuge', data.conyugeNombre);
      field('Fecha nac. cónyuge', data.conyugeFecha);
      field('DNI cónyuge', data.conyugeDni);
      field('Nacionalidad cónyuge', data.conyugeNacionalidad);
      if (data.partidaRegistral) field('Partida registral', data.partidaRegistral);
    }
    gap();

    // ── ACTIVIDAD PROFESIONAL ─────────────────────────────────────────────────
    section('Actividad Profesional', '💼');
    field('Ocupación / Profesión', data.ocupacion);
    field('Empresa / Negocio', data.empresa);
    field('Cargo actual', data.cargo);
    field('Rubro de la empresa', data.rubro);
    field('Antigüedad', data.antiguedad);
    field('Otra fuente de ingresos', '', t('otraFuente', data.otraFuente));
    if (data.otraFuente === 'si' && data.otraFuenteDetalle) field('Detalle', data.otraFuenteDetalle);
    gap();

    // ── PERFIL ECONÓMICO ──────────────────────────────────────────────────────
    section('Perfil Económico Referencial', '📊');
    field('Ingresos mensuales aprox.', '', t('rangoIngresos', data.rangoIngresos));
    field('Patrimonio líquido estimado', '', t('patrimonioLiquido', data.patrimonioLiquido));
    field('Inversión EGOA con', '', t('formaInversion', data.formaInversion));
    if (data.formaInversion === 'otro' && data.formaInversionOtro) field('Especificar', data.formaInversionOtro);
    field('Propietario de inmueble', '', t('esPropietario', data.esPropietario));
    if (data.esPropietario === 'si' && data.tiposPropiedades?.length) field('Tipos de inmuebles', '', t('tiposPropiedades', data.tiposPropiedades));
    field('¿Ha tenido 2a propiedad?', '', t('tieneSegundaPropiedad', data.tieneSegundaPropiedad));
    if (data.tieneSegundaPropiedad === 'si' && data.retoPrincipal) field('Principal reto', data.retoPrincipal);
    gap();

    // ── INTERÉS EN COPROPIEDAD ────────────────────────────────────────────────
    section('Interés en Copropiedad EGOA', '🏠');
    field('Tipo de propiedad', '', t('tipoInteres', data.tipoInteres));
    if (data.tipoInteres?.includes('otro') && data.tipoInteresOtro) field('Especificar tipo', data.tipoInteresOtro);
    field('Frecuencia de uso', '', t('frecuenciaUso', data.frecuenciaUso));
    field('Prioridad de inversión', '', t('prioridadInversion', data.prioridadInversion));
    if (data.prioridadInversion?.includes('otro') && data.prioridadOtro) field('Otra prioridad', data.prioridadOtro);
    gap();

    // ── RANGO DE INVERSIÓN ────────────────────────────────────────────────────
    section('Rango de Inversión y Origen de Fondos', '💰');
    field('Rango de inversión por fracción', '', t('rangoInversionEgoa', data.rangoInversionEgoa));
    field('Horizonte de permanencia', '', t('horizonteTiempo', data.horizonteTiempo));
    field('Origen principal de fondos', '', t('origenFondos', data.origenFondos));
    if (data.origenFondos === 'otro' && data.origenFondosOtro) field('Especificar origen', data.origenFondosOtro);
    field('Declaración origen lícito', '', t('declaraOrigenLicito', data.declaraOrigenLicito));
    gap();

    // ── COMPRA Y FINANCIAMIENTO ───────────────────────────────────────────────
    section('Compra, Financiamiento y Encaje', '🏦');
    field('Forma de pago', '', t('formaPago', data.formaPago));
    if (data.formaPago === 'combinado') {
      field('Requiere financiamiento adicional', '', t('requiereFinanciamiento', data.requiereFinanciamiento));
      if (data.requiereFinanciamiento === 'si') {
        field('Fuente de financiamiento', '', t('fuenteFinanciamiento', data.fuenteFinanciamiento));
        if (data.fuenteFinanciamiento === 'otro' && data.fuenteFinanciamientoOtro) field('Especificar fuente', data.fuenteFinanciamientoOtro);
        if (data.fuenteFinanciamiento === 'altera') {
          field('¿Tiene garantía hipotecaria?', '', t('tieneGarantia', data.tieneGarantia));
          if (data.tieneGarantia === 'si') {
            field('Tipo de inmueble (garantía)', data.tipoInmuebleGarantia);
            field('Ciudad / Distrito (garantía)', data.ciudadGarantia);
            if (data.valorGarantiaUSD) field('Valor estimado US$', `US$ ${data.valorGarantiaUSD}`);
            if (data.valorGarantiaSoles) field('Valor estimado S/.', `S/ ${data.valorGarantiaSoles}`);
            field('Situación registral', '', t('situacionRegistral', data.situacionRegistral));
            if (data.situacionRegistral === 'cargas' && data.situacionRegistralDetalle) field('Detalle de cargas', data.situacionRegistralDetalle);
          }
        }
      }
    }
    if (data.encajeEfectivoUSD)  field('Encaje en efectivo US$', `US$ ${data.encajeEfectivoUSD}`);
    if (data.encajeEfectivoSoles) field('Encaje en efectivo S/.', `S/ ${data.encajeEfectivoSoles}`);
    if (data.porcentajeEncaje)    field('% del valor EGOA', `${data.porcentajeEncaje}%`);
    field('Persona Políticamente Expuesta', '', t('esPEP', data.esPEP));
    if (data.esPEP === 'si' && data.pepDetalle) field('Cargo / Relación PEP', data.pepDetalle);
    field('¿Cómo conoció EGOA?', '', t('comoConocioEgoa', data.comoConocioEgoa));
    gap();

    // ── DECLARACIÓN ───────────────────────────────────────────────────────────
    section('Declaración y Autorización', '✍️');
    field('Lugar y fecha', data.lugarFecha);
    field('Nombre del solicitante', data.nombreSolicitante);
    field('Acepta declaración', '', t('aceptaDeclaracion', data.aceptaDeclaracion));

    gap(16);

    // Caja de estado
    checkBreak(40);
    doc.rect(MARGIN, y, COL, 30).fill('#FEF3C7');
    doc.rect(MARGIN, y, 4, 30).fill('#F59E0B');
    doc.fontSize(8.5).fillColor('#92400E').font('Helvetica-Bold')
       .text('ESTADO: Pendiente de revisión', MARGIN + 12, y + 7, { width: COL - 20 });
    doc.fontSize(8).fillColor('#B45309').font('Helvetica')
       .text(`Recibida el ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })}`, MARGIN + 12, y + 18, { width: COL - 20 });
    y += 38;

    // ── FOOTER en todas las páginas ───────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, 820, W, 22).fill('#0F172A');
      doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
         .text(`EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app · 958 540 663  |  Página ${i+1} de ${totalPages}`,
               0, 826, { align: 'center', width: W });
    }

    doc.end();
  });
}

// ─── Email al administrador con TODO el formulario ───────────────────────────
function buildAdminEmail(data: any, nombre: string): string {
  const row = (label: string, value: any, field?: string) => {
    const v = field ? t(field, value) : (value ?? '—');
    if (!v || v === '—') return '';
    return `
      <tr>
        <td style="padding:7px 14px;font-size:12px;color:#6B7280;width:42%;border-bottom:1px solid #F3F4F6">${esc(label)}</td>
        <td style="padding:7px 14px;font-size:12px;font-weight:600;color:#111827;border-bottom:1px solid #F3F4F6">${esc(String(v))}</td>
      </tr>`;
  };

  const section = (title: string, icon: string, rows: string) => `
    <div style="margin-bottom:20px">
      <div style="background:#1E40AF;padding:8px 14px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">${icon}</span>
        <span style="font-size:11px;font-weight:700;color:#fff;letter-spacing:0.8px;text-transform:uppercase">${title}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        ${rows}
      </table>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:20px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:620px;margin:0 auto">

      <!-- HEADER -->
      <div style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:48px;margin-bottom:14px" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Nueva solicitud de admisión</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">Pendiente de revisión por el equipo EGOA</p>
      </div>

      <!-- SOLICITANTE -->
      <div style="background:#1E3A8A;padding:16px 24px">
        <p style="margin:0;font-size:17px;font-weight:700;color:#fff">${esc(nombre)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#93C5FD">${esc(data.email ?? '')} · ${new Date().toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'})}</p>
      </div>

      <!-- CONTENIDO -->
      <div style="background:#F8FAFC;padding:20px 16px">

        ${section('Datos Personales', '👤', [
          row('Nombre completo', data.nombre),
          row('Fecha de nacimiento', data.fechaNacimiento),
          row('DNI / CE / Pasaporte', data.dni),
          row('Nacionalidad', data.nacionalidad),
          row('Dirección', data.direccion),
          row('Ciudad', data.ciudad),
          row('Celular', data.celular),
          row('Estado civil', data.estadoCivil, 'estadoCivil'),
          row('Sociedad de ganancias', data.sociedadGanancias, 'sociedadGanancias'),
          row('Nombre cónyuge', data.conyugeNombre),
          row('DNI cónyuge', data.conyugeDni),
          row('Nacionalidad cónyuge', data.conyugeNacionalidad),
          row('Partida registral', data.partidaRegistral),
        ].join(''))}

        ${section('Actividad Profesional', '💼', [
          row('Ocupación / Profesión', data.ocupacion),
          row('Empresa / Negocio', data.empresa),
          row('Cargo actual', data.cargo),
          row('Rubro', data.rubro),
          row('Antigüedad', data.antiguedad),
          row('Otra fuente de ingresos', data.otraFuente, 'otraFuente'),
          row('Detalle fuente', data.otraFuenteDetalle),
        ].join(''))}

        ${section('Perfil Económico', '📊', [
          row('Ingresos mensuales', data.rangoIngresos, 'rangoIngresos'),
          row('Patrimonio líquido', data.patrimonioLiquido, 'patrimonioLiquido'),
          row('Forma de inversión', data.formaInversion, 'formaInversion'),
          row('Forma inversión (otro)', data.formaInversionOtro),
          row('Propietario de inmueble', data.esPropietario, 'esPropietario'),
          row('Tipos de inmuebles', t('tiposPropiedades', data.tiposPropiedades)),
          row('Ha tenido 2a propiedad', data.tieneSegundaPropiedad, 'tieneSegundaPropiedad'),
          row('Principal reto', data.retoPrincipal),
        ].join(''))}

        ${section('Interés en Copropiedad EGOA', '🏠', [
          row('Tipo de propiedad', t('tipoInteres', data.tipoInteres)),
          row('Tipo (otro)', data.tipoInteresOtro),
          row('Frecuencia de uso', data.frecuenciaUso, 'frecuenciaUso'),
          row('Prioridad de inversión', t('prioridadInversion', data.prioridadInversion)),
          row('Prioridad (otro)', data.prioridadOtro),
        ].join(''))}

        ${section('Rango de Inversión y Origen de Fondos', '💰', [
          row('Rango a invertir', data.rangoInversionEgoa, 'rangoInversionEgoa'),
          row('Horizonte de tiempo', data.horizonteTiempo, 'horizonteTiempo'),
          row('Origen de fondos', data.origenFondos, 'origenFondos'),
          row('Origen (otro)', data.origenFondosOtro),
          row('Declaración origen lícito', data.declaraOrigenLicito, 'declaraOrigenLicito'),
        ].join(''))}

        ${section('Compra, Financiamiento y Encaje', '🏦', [
          row('Forma de pago', data.formaPago, 'formaPago'),
          row('Requiere financiamiento', data.requiereFinanciamiento, 'requiereFinanciamiento'),
          row('Fuente de financiamiento', data.fuenteFinanciamiento, 'fuenteFinanciamiento'),
          row('Fuente (otro)', data.fuenteFinanciamientoOtro),
          row('Tiene garantía hipotecaria', data.tieneGarantia, 'tieneGarantia'),
          row('Tipo inmueble (garantía)', data.tipoInmuebleGarantia),
          row('Ciudad (garantía)', data.ciudadGarantia),
          data.valorGarantiaUSD ? row('Valor garantía US$', `US$ ${data.valorGarantiaUSD}`) : '',
          data.valorGarantiaSoles ? row('Valor garantía S/.', `S/ ${data.valorGarantiaSoles}`) : '',
          row('Situación registral', data.situacionRegistral, 'situacionRegistral'),
          row('Detalle cargas', data.situacionRegistralDetalle),
          data.encajeEfectivoUSD ? row('Encaje US$', `US$ ${data.encajeEfectivoUSD}`) : '',
          data.encajeEfectivoSoles ? row('Encaje S/.', `S/ ${data.encajeEfectivoSoles}`) : '',
          data.porcentajeEncaje ? row('% del valor EGOA', `${data.porcentajeEncaje}%`) : '',
          row('Es PEP', data.esPEP, 'esPEP'),
          row('Cargo / Relación PEP', data.pepDetalle),
          row('¿Cómo conoció EGOA?', data.comoConocioEgoa, 'comoConocioEgoa'),
        ].join(''))}

        ${section('Declaración y Autorización', '✍️', [
          row('Lugar y fecha', data.lugarFecha),
          row('Nombre del solicitante', data.nombreSolicitante),
          row('Acepta declaración', data.aceptaDeclaracion, 'aceptaDeclaracion'),
        ].join(''))}

        <!-- Estado -->
        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:12px 16px;margin-top:4px">
          <p style="margin:0;font-size:12px;color:#92400E">
            <strong>📌 Estado:</strong> Pendiente de revisión ·
            Recibida el ${new Date().toLocaleDateString('es-PE', {day:'2-digit', month:'long', year:'numeric'})}
          </p>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app · 958 540 663</p>
      </div>

    </div>
  </body></html>`;
}

// ─── Email de confirmación al usuario ────────────────────────────────────────
function buildUserEmail(nombre: string, email: string): string {
  const first = esc(nombre.trim().split(' ')[0]);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:20px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:540px;margin:0 auto">

      <div style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:48px;margin-bottom:14px" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px">¡Solicitud recibida!</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">EGOA Capital · Proceso de admisión</p>
      </div>

      <div style="background:#fff;padding:28px 24px">
        <p style="font-size:16px;color:#111827;margin:0 0 8px">Hola <strong>${first}</strong>,</p>
        <p style="font-size:14px;color:#4B5563;line-height:1.6;margin:0 0 20px">
          Tu solicitud de admisión a <strong>EGOA Capital</strong> ha sido recibida correctamente.
          Adjunto a este correo encontrarás el PDF con el resumen completo de tu solicitud.
        </p>

        <div style="background:#EFF6FF;border-radius:12px;padding:18px;border:1px solid #BFDBFE;margin-bottom:20px">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.5px">¿Qué sigue ahora?</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${[
              ['✅', 'Tu solicitud está en la cola de revisión.'],
              ['🔍', 'El comité EGOA evaluará tu perfil en las próximas <strong>48 horas hábiles</strong>.'],
              ['📧', 'Recibirás un correo con el resultado de la evaluación.'],
              ['🏠', 'Si eres aprobado/a, tendrás acceso completo a la plataforma EGOA.'],
            ].map(([icon, text]) => `
              <div style="display:flex;gap:10px;align-items:flex-start">
                <span style="font-size:15px;min-width:22px">${icon}</span>
                <p style="margin:0;font-size:13px;color:#1E40AF;line-height:1.5">${text}</p>
              </div>`).join('')}
          </div>
        </div>

        <div style="background:#F0FDF4;border-radius:12px;padding:14px 16px;border:1px solid #BBF7D0">
          <p style="margin:0;font-size:13px;color:#14532D">
            ¿Tienes alguna pregunta? Escríbenos a
            <a href="mailto:operaciones@egoa.app" style="color:#1E40AF;font-weight:600">operaciones@egoa.app</a>
            o llámanos al <strong>958 540 663</strong>.
          </p>
        </div>
      </div>

      <div style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · Lima, Perú</p>
      </div>

    </div>
  </body></html>`;
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const data = req.body;
  const nombre = data.nombre || data.nombreSolicitante || 'Inversor';

  try {
    // 1. Guardar en base de datos
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
        forma_pago, fuente_financiamiento, tiene_garantia,
        tipo_inmueble_garantia, ciudad_garantia, valor_garantia_usd,
        encaje_efectivo_usd, encaje_efectivo_soles, porcentaje_encaje,
        es_pep, pep_detalle, como_conocio_egoa,
        lugar_fecha, nombre_solicitante, acepta_declaracion, status
      ) VALUES (
        ${data.email??null}, ${data.nombre??null}, ${data.fechaNacimiento??null},
        ${data.dni??null}, ${data.nacionalidad??null}, ${data.direccion??null},
        ${data.ciudad??null}, ${data.celular??null}, ${data.estadoCivil??null},
        ${data.sociedadGanancias??null}, ${data.partidaRegistral??null},
        ${data.conyugeNombre??null}, ${data.conyugeDni??null}, ${data.conyugeNacionalidad??null},
        ${data.ocupacion??null}, ${data.empresa??null}, ${data.cargo??null},
        ${data.rubro??null}, ${data.antiguedad??null},
        ${data.otraFuente??null}, ${data.otraFuenteDetalle??null},
        ${data.rangoIngresos??null}, ${data.patrimonioLiquido??null}, ${data.formaInversion??null},
        ${data.esPropietario??null},
        ${Array.isArray(data.tiposPropiedades)?data.tiposPropiedades.join(', '):null},
        ${data.tieneSegundaPropiedad??null}, ${data.retoPrincipal??null},
        ${Array.isArray(data.tipoInteres)?data.tipoInteres.join(', '):null},
        ${data.frecuenciaUso??null},
        ${Array.isArray(data.prioridadInversion)?data.prioridadInversion.join(', '):null},
        ${data.rangoInversionEgoa??null}, ${data.horizonteTiempo??null},
        ${data.origenFondos??null}, ${data.declaraOrigenLicito??null},
        ${data.formaPago??null}, ${data.fuenteFinanciamiento??null}, ${data.tieneGarantia??null},
        ${data.tipoInmuebleGarantia??null}, ${data.ciudadGarantia??null}, ${data.valorGarantiaUSD??null},
        ${data.encajeEfectivoUSD??null}, ${data.encajeEfectivoSoles??null}, ${data.porcentajeEncaje??null},
        ${data.esPEP??null}, ${data.pepDetalle??null}, ${data.comoConocioEgoa??null},
        ${data.lugarFecha??null}, ${data.nombreSolicitante??null}, ${data.aceptaDeclaracion??null},
        'pendiente'
      )
    `);

    // 2. Generar PDF
    const pdfBuffer = await generatePDF(data, nombre);
    const pdfFilename = `solicitud_${nombre.replace(/\s+/g,'_')}_${Date.now()}.pdf`;

    // 3. Configurar transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const attachment = [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }];

    // 4. Email al admin con HTML completo + PDF adjunto
    await transporter.sendMail({
      from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      bcc: YOUR_EMAIL,
      subject: `Nueva solicitud de admisión — ${nombre}`,
      html: buildAdminEmail(data, nombre),
      attachments: attachment,
    });

    // 5. Email de confirmación al usuario + PDF adjunto
    if (data.email?.includes('@')) {
      await transporter.sendMail({
        from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: 'Tu solicitud de admisión fue recibida — EGOA Capital',
        html: buildUserEmail(nombre, data.email),
        attachments: attachment,
      });
    }

    res.status(200).json({ message: 'Solicitud enviada correctamente' });

  } catch (error) {
    console.error('Admission error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud', detail: String(error) });
  }
}