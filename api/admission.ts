// back/api/admission.ts — v3
// Fixes: property_id + property_name en INSERT, emojis reemplazados por texto en PDF,
// email admin simplificado (solo PDF adjunto, sin HTML con datos),
// email usuario responsive para móvil.

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
  sociedadGanancias:  { si:'Si', no:'No' },
  otraFuente:         { si:'Si', no:'No' },
  esPropietario:      { si:'Si', no:'No' },
  tieneSegundaPropiedad:{ si:'Si', no:'No' },
  rangoIngresos:      { hasta5k:'Hasta US$ 5,000', '5k-10k':'US$ 5,001 - 10,000', '10k-20k':'US$ 10,001 - 20,000', mas20k:'Mas de US$ 20,000' },
  patrimonioLiquido:  { hasta100k:'Hasta US$ 100,000', '100k-300k':'US$ 100,001 - 300,000', '300k-1m':'US$ 300,001 - 1,000,000', mas1m:'Mas de US$ 1,000,000' },
  formaInversion:     { propios:'Recursos propios', venta:'Venta de otros activos', combinado:'Propios + financiamiento', otro:'Otro' },
  tiposPropiedades:   { vivienda:'Vivienda principal', dpto:'Departamento', playa:'Casa de playa', campo:'Casa de campo', terreno:'Terrenos', renta:'Inmuebles de renta' },
  tipoInteres:        { playa:'Casa de playa', campo:'Casa de campo', desierto:'Casa en desierto', otro:'Otro' },
  frecuenciaUso:      { esporadico:'Fines de semana esporadicos', temporadas:'Temporadas', escapadas:'Escapadas planificadas', indefinido:'Aun no lo tengo claro' },
  prioridadInversion: { lifestyle:'Estilo de vida / disfrute', capital:'Optimizar capital', plusvalia:'Plusvalia', diversificacion:'Diversificacion de patrimonio', otro:'Otro' },
  rangoInversionEgoa: { hasta80k:'Hasta US$ 80,000', '80k-150k':'US$ 80,001 - 150,000', '150k-250k':'US$ 150,001 - 250,000', mas250k:'Mas de US$ 250,000' },
  horizonteTiempo:    { '1-3':'01 a 03 anos', '3-5':'03 a 05 anos', mas5:'Mas de 05 anos', indefinido:'Aun no lo tengo claro' },
  origenFondos:       { profesional:'Ingresos profesionales / negocio', ahorros:'Ahorros acumulados', venta:'Venta de otros activos', herencia:'Herencia', otro:'Otro' },
  declaraOrigenLicito:{ si:'Declaracion aceptada', no:'No aceptada' },
  formaPago:          { contado:'Pago al contado - 100% recursos propios', combinado:'Pago combinado - recursos + financiamiento' },
  requiereFinanciamiento:{ si:'Si', no:'No' },
  fuenteFinanciamiento:{ banco:'Financiamiento bancario', altera:'Altera Finance (socio EGOA)', otro:'Otro' },
  tieneGarantia:      { si:'Si, cuenta con propiedad', no:'No cuenta con propiedad' },
  situacionRegistral: { limpio:'Sin cargas ni gravamenes', cargas:'Con cargas' },
  esPEP:              { si:'Si - es PEP', no:'No es PEP' },
  comoConocioEgoa:    { redes:'Redes sociales', evento:'Evento en el club / Stand', referido:'Referido', asesor:'Referido por asesor financiero / inmobiliario', aliado:'Cliente de Altera / Harvest / Grupo aliado', otro:'Otro' },
  aceptaDeclaracion:  { si:'Declaracion aceptada y firmada', no:'No aceptada' },
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

// ─── Generador PDF — Diseño renovado ─────────────────────────────────────────
async function generatePDF(data: any, nombre: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const logoBuffer = await fetchLogo();
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const bufs: Buffer[] = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    // ── Paleta ────────────────────────────────────────────────────────────────
    const C = {
      navy:      '#0B1629',   // fondo oscuro
      navyMid:   '#132040',   // fondo medio
      blue:      '#1A56DB',   // azul acento principal
      blueSoft:  '#EBF0FF',   // azul muy claro para fila par
      accent:    '#3B82F6',   // azul brillante para detalles
      gold:      '#D97706',   // dorado estado
      goldBg:    '#FFFBEB',
      goldLine:  '#FCD34D',
      text:      '#111827',
      textSoft:  '#6B7280',
      line:      '#E5E7EB',
      white:     '#FFFFFF',
      pageBg:    '#F7F9FC',   // fondo de página (no blanco puro)
    };

    const W      = 595.28;
    const H_PAGE = 841.89;
    const ML     = 44;        // margen izquierdo
    const MR     = 44;        // margen derecho
    const COL    = W - ML - MR;
    const FOOTER = 30;        // altura footer
    const SAFE   = H_PAGE - FOOTER - 12; // límite Y antes de footer
    let y        = 0;
    let rowToggle = false;

    // ── Dibuja fondo gris suave en la página actual ───────────────────────────
    const paintPageBg = () => {
      doc.rect(0, 0, W, H_PAGE).fill(C.pageBg);
    };

    // ── Mini-header para páginas 2+ ───────────────────────────────────────────
    const drawPageHeader = () => {
      // Barra top pequeña
      doc.rect(0, 0, W, 36).fill(C.navy);
      if (logoBuffer) {
        try { doc.image(logoBuffer, ML, 8, { height: 20 }); } catch {}
      }
      doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
         .text('EGOA Capital S.A.C.  |  Solicitud de Admision  |  Confidencial',
               0, 14, { width: W, align: 'center' });
      // Línea azul delgada debajo
      doc.rect(0, 36, W, 2).fill(C.blue);
      y = 48;
    };

    // ── Salto de página ───────────────────────────────────────────────────────
    const checkBreak = (need: number) => {
      if (y + need > SAFE) {
        doc.addPage();
        paintPageBg();
        drawPageHeader();
        rowToggle = false;
      }
    };

    // ── Cabecera de sección ───────────────────────────────────────────────────
    const section = (title: string) => {
      checkBreak(44);
      const SH = 26;
      // Rectángulo azul con borde izquierdo dorado
      doc.rect(ML, y, COL, SH).fill(C.blue);
      doc.rect(ML, y, 4, SH).fill(C.goldLine);
      doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold')
         .text(title.toUpperCase(), ML + 14, y + 9, { width: COL - 20, characterSpacing: 0.6 });
      y += SH + 2;
      rowToggle = false;
    };

    // ── Fila de campo ─────────────────────────────────────────────────────────
    const ROW_H = 19;
    const field = (label: string, value: any, translated?: string) => {
      const val = translated ?? String(value ?? '');
      if (!val || val === '-' || val === '—') return;
      checkBreak(ROW_H);

      const bg = rowToggle ? C.blueSoft : C.white;
      rowToggle = !rowToggle;

      doc.rect(ML, y, COL, ROW_H).fill(bg);

      // Separador derecho del label
      const labelW = COL * 0.42;
      doc.rect(ML + labelW, y, 1, ROW_H).fill(C.line);

      doc.fontSize(8).fillColor(C.textSoft).font('Helvetica')
         .text(label, ML + 10, y + 5.5, { width: labelW - 14, ellipsis: true });
      doc.fontSize(8.2).fillColor(C.text).font('Helvetica-Bold')
         .text(val, ML + labelW + 10, y + 5.5, { width: COL - labelW - 16, ellipsis: true });

      // línea inferior muy sutil
      doc.rect(ML, y + ROW_H - 0.5, COL, 0.5).fill(C.line);
      y += ROW_H;
    };

    const gap = (n = 10) => { y += n; };

    // ════════════════════════════════════════════════════════════════════════════
    // PORTADA — Página 1
    // ════════════════════════════════════════════════════════════════════════════
    paintPageBg();

    // Bloque superior oscuro (alto: 160px)
    doc.rect(0, 0, W, 160).fill(C.navy);

    // Línea decorativa azul en la parte baja del bloque oscuro
    doc.rect(0, 158, W, 3).fill(C.blue);

    // Logo (izquierda) + título (centrado)
    if (logoBuffer) {
      try { doc.image(logoBuffer, ML, 20, { height: 44 }); } catch {}
    }

    // Título
    doc.fontSize(20).fillColor(C.white).font('Helvetica-Bold')
       .text('Solicitud de Admision', 0, 24, { align: 'center', width: W });
    doc.fontSize(8.5).fillColor('#93C5FD').font('Helvetica')
       .text('EGOA Capital S.A.C.  |  RUC 20613300997  |  Documento Confidencial',
             0, 50, { align: 'center', width: W });

    // ── Tarjeta del solicitante ───────────────────────────────────────────────
    // Fondo blanco con sombra simulada (rectángulo gris desplazado)
    doc.rect(ML + 3, 77, COL, 72).fill('#D1D5DB');       // sombra
    doc.rect(ML, 74, COL, 72).fill(C.white);              // tarjeta

    // Borde izquierdo azul
    doc.rect(ML, 74, 5, 72).fill(C.blue);

    // Iniciales en círculo azul
    const initials = nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const cx = ML + 38, cy = 110;
    doc.circle(cx, cy, 22).fill(C.blue);
    doc.fontSize(13).fillColor(C.white).font('Helvetica-Bold')
       .text(initials, cx - 22, cy - 9, { width: 44, align: 'center' });

    // Datos del solicitante
    const tx = ML + 72;
    doc.fontSize(14).fillColor(C.text).font('Helvetica-Bold')
       .text(nombre, tx, 82, { width: COL - 80 });
    doc.fontSize(9).fillColor(C.textSoft).font('Helvetica')
       .text(data.email ?? '', tx, 100, { width: COL - 80 });

    if (data.propertyName) {
      doc.fontSize(8.5).fillColor(C.blue).font('Helvetica-Bold')
         .text(`Propiedad: ${data.propertyName}`, tx, 116, { width: COL - 80 });
    }

    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });
    doc.fontSize(8).fillColor(C.textSoft).font('Helvetica')
       .text(`Fecha de recepcion: ${fecha}`, tx, data.propertyName ? 130 : 116, { width: COL - 80 });

    y = 168;

    // ── BLOQUE DE ESTADO al inicio (badge) ───────────────────────────────────
    gap(8);
    doc.rect(ML, y, COL, 26).fill(C.goldBg);
    doc.rect(ML, y, 4, 26).fill(C.gold);
    doc.fontSize(8).fillColor('#92400E').font('Helvetica-Bold')
       .text('ESTADO: PENDIENTE DE REVISION', ML + 14, y + 9, { width: COL * 0.5 });
    doc.fontSize(8).fillColor('#B45309').font('Helvetica')
       .text(`Recibida: ${fecha}`, ML + COL * 0.55, y + 9, { width: COL * 0.4, align: 'right' });
    y += 34;
    gap(4);

    // ════════════════════════════════════════════════════════════════════════════
    // SECCIONES DE DATOS
    // ════════════════════════════════════════════════════════════════════════════

    section('1. Datos Personales');
    field('Nombre completo', data.nombre);
    field('Fecha de nacimiento', data.fechaNacimiento);
    field('DNI / CE / Pasaporte', data.dni);
    field('Nacionalidad', data.nacionalidad);
    field('Direccion', data.direccion);
    field('Ciudad', data.ciudad);
    field('Celular', data.celular);
    field('Estado civil', data.estadoCivil, t('estadoCivil', data.estadoCivil));
    if (data.estadoCivil === 'casado') {
      field('Sociedad de ganancias', '', t('sociedadGanancias', data.sociedadGanancias));
      field('Nombre del conyuge', data.conyugeNombre);
      field('Fecha nac. conyuge', data.conyugeFecha);
      field('DNI conyuge', data.conyugeDni);
      field('Nacionalidad conyuge', data.conyugeNacionalidad);
      if (data.partidaRegistral) field('Partida registral', data.partidaRegistral);
    }
    gap();

    section('2. Actividad Profesional');
    field('Ocupacion / Profesion', data.ocupacion);
    field('Empresa / Negocio', data.empresa);
    field('Cargo actual', data.cargo);
    field('Rubro de la empresa', data.rubro);
    field('Antiguedad en el cargo', data.antiguedad);
    field('Otra fuente de ingresos', '', t('otraFuente', data.otraFuente));
    if (data.otraFuente === 'si' && data.otraFuenteDetalle) field('Detalle fuente adicional', data.otraFuenteDetalle);
    gap();

    section('3. Perfil Economico Referencial');
    field('Ingresos mensuales aprox.', '', t('rangoIngresos', data.rangoIngresos));
    field('Patrimonio liquido estimado', '', t('patrimonioLiquido', data.patrimonioLiquido));
    field('Fondos de inversion EGOA', '', t('formaInversion', data.formaInversion));
    if (data.formaInversion === 'otro' && data.formaInversionOtro) field('Especificar', data.formaInversionOtro);
    field('Es propietario de inmueble', '', t('esPropietario', data.esPropietario));
    if (data.esPropietario === 'si' && data.tiposPropiedades?.length) field('Tipos de inmuebles', '', t('tiposPropiedades', data.tiposPropiedades));
    field('Ha tenido segunda propiedad', '', t('tieneSegundaPropiedad', data.tieneSegundaPropiedad));
    if (data.tieneSegundaPropiedad === 'si' && data.retoPrincipal) field('Principal reto experimentado', data.retoPrincipal);
    gap();

    section('4. Interes en Copropiedad EGOA');
    field('Tipo de propiedad deseada', '', t('tipoInteres', data.tipoInteres));
    if (data.tipoInteres?.includes('otro') && data.tipoInteresOtro) field('Especificar tipo', data.tipoInteresOtro);
    field('Frecuencia de uso prevista', '', t('frecuenciaUso', data.frecuenciaUso));
    field('Prioridad de la inversion', '', t('prioridadInversion', data.prioridadInversion));
    if (data.prioridadInversion?.includes('otro') && data.prioridadOtro) field('Otra prioridad', data.prioridadOtro);
    gap();

    section('5. Rango de Inversion y Origen de Fondos');
    field('Rango a invertir (por fraccion)', '', t('rangoInversionEgoa', data.rangoInversionEgoa));
    field('Horizonte de permanencia', '', t('horizonteTiempo', data.horizonteTiempo));
    field('Origen principal de fondos', '', t('origenFondos', data.origenFondos));
    if (data.origenFondos === 'otro' && data.origenFondosOtro) field('Especificar origen', data.origenFondosOtro);
    field('Declaracion de origen licito', '', t('declaraOrigenLicito', data.declaraOrigenLicito));
    gap();

    section('6. Compra, Financiamiento y Encaje');
    field('Forma de pago', '', t('formaPago', data.formaPago));
    if (data.formaPago === 'combinado') {
      field('Requiere financiamiento adicional', '', t('requiereFinanciamiento', data.requiereFinanciamiento));
      if (data.requiereFinanciamiento === 'si') {
        field('Fuente de financiamiento', '', t('fuenteFinanciamiento', data.fuenteFinanciamiento));
        if (data.fuenteFinanciamiento === 'otro' && data.fuenteFinanciamientoOtro) field('Especificar fuente', data.fuenteFinanciamientoOtro);
        if (data.fuenteFinanciamiento === 'altera') {
          field('Tiene garantia hipotecaria', '', t('tieneGarantia', data.tieneGarantia));
          if (data.tieneGarantia === 'si') {
            field('Tipo de inmueble (garantia)', data.tipoInmuebleGarantia);
            field('Ciudad / Distrito (garantia)', data.ciudadGarantia);
            if (data.valorGarantiaUSD)   field('Valor estimado US$', `US$ ${data.valorGarantiaUSD}`);
            if (data.valorGarantiaSoles) field('Valor estimado S/.', `S/ ${data.valorGarantiaSoles}`);
            field('Situacion registral', '', t('situacionRegistral', data.situacionRegistral));
            if (data.situacionRegistral === 'cargas' && data.situacionRegistralDetalle) field('Detalle de cargas', data.situacionRegistralDetalle);
          }
        }
      }
    }
    if (data.encajeEfectivoUSD)   field('Encaje en efectivo US$', `US$ ${data.encajeEfectivoUSD}`);
    if (data.encajeEfectivoSoles) field('Encaje en efectivo S/.', `S/ ${data.encajeEfectivoSoles}`);
    if (data.porcentajeEncaje)    field('Porcentaje del valor EGOA', `${data.porcentajeEncaje}%`);
    field('Persona Politicamente Expuesta', '', t('esPEP', data.esPEP));
    if (data.esPEP === 'si' && data.pepDetalle) field('Cargo / Relacion PEP', data.pepDetalle);
    field('Como conocio EGOA', '', t('comoConocioEgoa', data.comoConocioEgoa));
    gap();

    section('7. Declaracion y Autorizacion');
    field('Lugar y fecha de firma', data.lugarFecha);
    field('Nombre del solicitante', data.nombreSolicitante);
    field('Acepta declaracion jurada', '', t('aceptaDeclaracion', data.aceptaDeclaracion));
    gap(14);

    // ── Nota legal final ──────────────────────────────────────────────────────
    checkBreak(48);
    doc.rect(ML, y, COL, 40).fill('#F1F5F9');
    doc.rect(ML, y, 2, 40).fill(C.accent);
    doc.fontSize(7.5).fillColor(C.textSoft).font('Helvetica')
       .text(
         'Este documento es de caracter confidencial y ha sido generado automaticamente por el sistema de admision de EGOA Capital S.A.C. ' +
         'La informacion contenida en este formulario sera tratada de acuerdo con la politica de privacidad de la empresa y la normativa vigente.',
         ML + 10, y + 8, { width: COL - 16, lineGap: 2 }
       );
    y += 48;

    // ════════════════════════════════════════════════════════════════════════════
    // FOOTER — todas las páginas
    // ════════════════════════════════════════════════════════════════════════════
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      // Línea separadora
      doc.rect(0, H_PAGE - FOOTER - 1, W, 1).fill(C.line);
      // Fondo footer
      doc.rect(0, H_PAGE - FOOTER, W, FOOTER).fill(C.navy);

      const footerY = H_PAGE - FOOTER + 10;
      doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
         .text(
           'EGOA Capital S.A.C.  |  RUC 20613300997  |  operaciones@egoa.app  |  958 540 663',
           ML, footerY, { width: COL * 0.7 }
         );
      doc.fontSize(7).fillColor('#94A3B8').font('Helvetica-Bold')
         .text(
           `Pagina ${i + 1} de ${totalPages}`,
           ML, footerY, { width: COL, align: 'right' }
         );
    }

    doc.end();
  });
}

// ─── Email al administrador: SOLO aviso + PDF adjunto (sin tabla HTML de datos) ──
function buildAdminEmail(data: any, nombre: string): string {
  const propertyLine = data.propertyName
    ? `<p style="margin:4px 0 0;font-size:13px;color:#93C5FD">Propiedad de interes: <strong style="color:#fff">${esc(data.propertyName)}</strong></p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body style="margin:0;padding:20px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:560px;margin:0 auto">

      <div style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:60px;margin-bottom:14px" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Nueva solicitud de admision</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">Pendiente de revision por el equipo EGOA</p>
      </div>

      <div style="background:#1E3A8A;padding:16px 24px">
        <p style="margin:0;font-size:17px;font-weight:700;color:#fff">${esc(nombre)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#93C5FD">${esc(data.email ?? '')}</p>
        ${propertyLine}
        <p style="margin:6px 0 0;font-size:12px;color:#BFDBFE">${new Date().toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'})}</p>
      </div>

      <div style="background:#fff;padding:28px 24px">
        <p style="font-size:15px;color:#111827;margin:0 0 12px">Hola equipo,</p>
        <p style="font-size:14px;color:#4B5563;line-height:1.6;margin:0 0 20px">
          Se ha recibido una nueva solicitud de admision de <strong>${esc(nombre)}</strong>.
          Todos los datos del solicitante se encuentran en el <strong>PDF adjunto</strong>.
        </p>

        <div style="background:#EFF6FF;border-radius:10px;padding:16px;border:1px solid #BFDBFE;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.5px">Resumen rapido</p>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280;width:45%">Nombre</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(nombre)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280">Email</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(data.email ?? '—')}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280">Celular</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(data.celular ?? '—')}</td>
            </tr>
            ${data.propertyName ? `
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280">Propiedad de interes</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1E40AF">${esc(data.propertyName)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280">Rango inversion</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(t('rangoInversionEgoa', data.rangoInversionEgoa))}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6B7280">Forma de pago</td>
              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(t('formaPago', data.formaPago))}</td>
            </tr>
          </table>
        </div>

        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:12px 16px">
          <p style="margin:0;font-size:12px;color:#92400E">
            <strong>Estado:</strong> Pendiente de revision &nbsp;·&nbsp;
            Recibida el ${new Date().toLocaleDateString('es-PE', {day:'2-digit', month:'long', year:'numeric'})}
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#92400E">
            Ver todos los detalles en el <strong>PDF adjunto</strong>.
          </p>
        </div>
      </div>

      <div style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app · 958 540 663</p>
      </div>

    </div>
  </body></html>`;
}

// ─── Email de confirmación al usuario (responsive para móvil) ────────────────
function buildUserEmail(nombre: string, email: string, propertyName?: string): string {
  const first = esc(nombre.trim().split(' ')[0]);
  const propLine = propertyName
    ? `<p style="font-size:13px;color:#4B5563;margin:0 0 16px">Propiedad de interes: <strong style="color:#1E40AF">${esc(propertyName)}</strong></p>`
    : '';

  // Steps como lista vertical (no grid horizontal) para que se vea bien en móvil
  const steps = [
    ['Tu solicitud esta en la cola de revision.'],
    ['El comite EGOA evaluara tu perfil en las proximas <strong>48 horas habiles</strong>.'],
    ['Recibiras un correo con el resultado de la evaluacion.'],
    ['Si eres aprobado/a, tendras acceso completo a la plataforma EGOA.'],
  ];

  return `<!DOCTYPE html><html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { margin:0; padding:0; background:#F1F5F9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; }
      .wrap { max-width:540px; margin:20px auto; }
      @media only screen and (max-width:600px) {
        .wrap { margin:0 !important; border-radius:0 !important; }
        .header, .footer { border-radius:0 !important; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">

      <div class="header" style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:60px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Solicitud recibida</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">EGOA Capital · Proceso de admision</p>
      </div>

      <div style="background:#fff;padding:28px 20px">
        <p style="font-size:16px;color:#111827;margin:0 0 8px">Hola <strong>${first}</strong>,</p>
        <p style="font-size:14px;color:#4B5563;line-height:1.6;margin:0 0 16px">
          Tu solicitud de admision a <strong>EGOA Capital</strong> ha sido recibida correctamente.
          Adjunto a este correo encontraras el PDF con el resumen completo de tu solicitud.
        </p>
        ${propLine}

        <div style="background:#EFF6FF;border-radius:10px;padding:18px;border:1px solid #BFDBFE;margin-bottom:20px">
          <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.5px">Que sigue ahora?</p>
          ${steps.map(([text], i) => `
            <div style="display:flex;align-items:flex-start;margin-bottom:${i < steps.length-1 ? '12px' : '0'}">
              <div style="min-width:24px;height:24px;border-radius:50%;background:#1E40AF;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;line-height:24px;text-align:center">${i+1}</div>
              <p style="margin:0;font-size:13px;color:#1E40AF;line-height:1.5;padding-top:3px">${text}</p>
            </div>
          `).join('')}
        </div>

        <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;border:1px solid #BBF7D0">
          <p style="margin:0;font-size:13px;color:#14532D">
            Tienes alguna pregunta? Escribenos a
            <a href="mailto:operaciones@egoa.app" style="color:#1E40AF;font-weight:600">operaciones@egoa.app</a>
            o llamanos al <strong>958 540 663</strong>.
          </p>
        </div>
      </div>

      <div class="footer" style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · Lima, Peru</p>
      </div>

    </div>
  </body></html>`;
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const data = req.body;
  const nombre = data.nombre || data.nombreSolicitante || 'Inversor';

  try {
    // 1. Guardar en base de datos (incluye property_id y property_name)
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
        lugar_fecha, nombre_solicitante, acepta_declaracion,
        property_id, property_name,
        status
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
        ${data.propertyId??null}, ${data.propertyName??null},
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

    // 4. Email al admin: aviso breve + PDF adjunto (sin tabla HTML de todos los datos)
    await transporter.sendMail({
      from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      bcc: YOUR_EMAIL,
      subject: `Nueva solicitud de admision — ${nombre}`,
      html: buildAdminEmail(data, nombre),
      attachments: attachment,
    });

    // 5. Email de confirmación al usuario + PDF adjunto
    if (data.email?.includes('@')) {
      await transporter.sendMail({
        from: `"EGOA Capital" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: 'Tu solicitud de admision fue recibida — EGOA Capital',
        html: buildUserEmail(nombre, data.email, data.propertyName),
        attachments: attachment,
      });
    }

    res.status(200).json({ message: 'Solicitud enviada correctamente' });

  } catch (error) {
    console.error('Admission error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud', detail: String(error) });
  }
}