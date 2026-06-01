// back/api/properties/sell-evaluation.ts
// Endpoint POST /api/sell-evaluation
// Guarda en Neon, genera PDF y envía emails (admin + propietario)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './../db';
import { sellEvaluations } from './../schema';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

const ADMIN_EMAIL = 'operaciones@egoa.app';
const YOUR_EMAIL  = 'ofabianmisael@gmail.com';
const LOGO_URL    = 'https://egoa-backend-fabians-projects-4888a274.vercel.app/eGOa_logo.png';

// ── Traducciones — alineadas con valores exactos del frontend ─────────────────
const T: Record<string, Record<string, string>> = {
  // Paso 0
  tipoPropiedad: {
    unico:         'Si, soy propietario unico',
    copropietario: 'Si, soy copropietario',
    empresa:       'Propiedad de empresa familiar',
    sucesion:      'Propiedad en sucesion / herencia',
    tercero:       'Consultando por encargo de tercero',
  },
  quienDecide: {
    yo:             'Yo tomo la decision directamente',
    familia:        'Depende de mi familia',
    copropietarios: 'Depende de varios copropietarios',
    empresa:        'Depende de una empresa',
    indefinido:     'Aun no esta definido',
  },
  // Paso 1
  ubicacionZona: {
    playa:   'Playa',
    campo:   'Campo',
    ciudad:  'Ciudad',
    montaña: 'Montaña / sierra',
    selva:   'Selva',
    otro:    'Otro',
  },
  tipoInmueble: {
    casa_playa:       'Casa de playa',
    casa_campo:       'Casa de campo',
    departamento_lujo:'Departamento de lujo',
    terreno:          'Terreno con proyecto',
    casa_urbana:      'Casa urbana',
    remodelacion:     'Propiedad para remodelar',
    otro:             'Otro',
  },
  areaTerreno: {
    menos300:  'Menos de 300 m2',
    '300-500': '300 m2 a 500 m2',
    '500-1000':'500 m2 a 1,000 m2',
    mas1000:   'Mas de 1,000 m2',
    no_se:     'No estoy seguro',
  },
  areaConstruida: {
    menos100:  'Menos de 100 m2',
    '100-200': '100 m2 a 200 m2',
    '200-400': '200 m2 a 400 m2',
    mas400:    'Mas de 400 m2',
    no_se:     'No estoy seguro',
  },
  caracteristicas: {
    piscina:        'Piscina',
    bbq:            'Parrilla / zona BBQ',
    terraza:        'Terraza',
    jardin:         'Jardin',
    vista_mar:      'Vista al mar',
    vista_campo:    'Vista al campo / naturaleza',
    chimenea:       'Chimenea',
    estacionamiento:'Estacionamientos',
    amoblada:       'Amoblada',
    estreno:        'Casa de estreno',
    remodelacion:   'Requiere remodelacion',
  },
  // Paso 2
  inscritaRegistros: {
    si:    'Si',
    no:    'No',
    no_se: 'No estoy seguro',
  },
  tieneCargas: {
    no:         'No, esta libre de cargas',
    hipoteca:   'Si, tiene hipoteca',
    carga_legal:'Si, tiene alguna carga legal',
    no_se:      'No estoy seguro',
  },
  documentosOrden: {
    si:      'Si, todo esta saneado',
    parcial: 'Parcialmente',
    no:      'No, falta regularizar documentos',
    no_se:   'No estoy seguro',
  },
  estadoOcupacion: {
    libre:                'No, esta libre',
    uso_ocasional:        'Si, la uso ocasionalmente',
    alquilada_temporada:  'Si, alquilada por temporadas',
    habitada_permanente:  'Si, vive alguien de forma permanente',
  },
  tieneMaterial: {
    fotos_pro:     'Fotos profesionales',
    fotos_simples: 'Fotos simples',
    videos:        'Videos',
    planos:        'Planos',
    sin_material:  'Sin material todavia',
  },
  // Paso 3
  opcionVenta: {
    '100':       'Vender el 100% de mi propiedad',
    parcial:     'Vender una parte y conservar otra',
    ambas:       'Evaluar ambas opciones',
    informacion: 'Solo quiero conocer el modelo',
  },
  porcentajeConservar: {
    ninguno: 'No deseo conservar participacion',
    '12.5':  'Hasta 12.5% - 45 dias de uso',
    '25':    'Hasta 25% - 90 dias de uso',
    '37.5':  'Hasta 37.5% - 135 dias de uso',
    '50':    'Hasta 50% - 180 dias de uso',
    no_se:   'Aun no lo se',
  },
  motivoVenta: {
    liquidez:        'Obtener liquidez',
    poco_uso:        'Uso poco la propiedad',
    costos:          'Costos de mantenimiento altos',
    responsabilidades:'Reducir responsabilidades',
    otro_proyecto:   'Invertir en otro proyecto',
    conservar_parte: 'Conservar parte y seguir usandola',
    impacto:         'Generar impacto social',
    otro:            'Otro motivo',
  },
  plazoVenta: {
    urgente:     'Lo antes posible',
    '1-3m':      'En 1 a 3 meses',
    '3-6m':      'En 3 a 6 meses',
    '6-12m':     'En 6 a 12 meses',
    sin_urgencia:'Sin urgencia',
  },
  aceptaTasacion: {
    si:       'Si, deseo una evaluacion',
    si_info:  'Si, quiero conocer primero el proceso',
    tal_vez:  'Tal vez',
    no:       'No por ahora',
  },
  // Paso 4
  seguirUsando: {
    si:          'Si, definitivamente',
    si_ocasional:'Si, ocasionalmente',
    tal_vez:     'Tal vez',
    no:          'No, prefiero vender todo',
  },
  diasUso: {
    ninguno: 'No deseo usarla despues de vender',
    '15-30': '15 a 30 dias',
    '30-60': '30 a 60 dias',
    '60-90': '60 a 90 dias',
    mas90:   'Mas de 90 dias',
    no_se:   'Aun no lo se',
  },
  compartirUso: {
    si:       'Si',
    si_reglas:'Si, si las reglas son claras',
    depende:  'Depende de las condiciones',
    no:       'No',
  },
  importanteConservar: {
    fechas:         'Fechas garantizadas de uso',
    costos:         'Reducir costos de mantenimiento',
    administracion: 'Que este bien administrada',
    copropietarios: 'Que los copropietarios sean evaluados',
    vender_despues: 'Poder vender mi participacion mas adelante',
    todas:          'Todas las anteriores',
  },
  // Paso 5
  importanciaImpacto: {
    muy:          'Muy importante',
    importante:   'Importante',
    secundario:   'Me interesa, pero no es lo principal',
    no_relevante: 'No es relevante para mi decision',
  },
  contribuirVivienda: {
    si:       'Si, me gustaria ser parte de ese impacto',
    si_info:  'Si, quiero conocer como se ejecuta',
    tal_vez:  'Tal vez',
    no:       'No por ahora',
  },
  tipoCausa: {
    familias:      'Familias vulnerables',
    madres:        'Madres solteras',
    adultos_mayores:'Adultos mayores sin vivienda',
    ninos:         'Familias con ninos',
    egoa_decide:   'La causa que eGOa considere prioritaria',
    mas_info:      'Me gustaria recibir mas informacion',
  },
  aceptarHistoria: {
    publico:  'Si, con mi nombre y propiedad',
    anonimo:  'Si, de forma anonima',
    tal_vez:  'Tal vez, previa autorizacion',
    no:       'No',
  },
  // Paso 6
  expectativas: {
    rapida:       'Venta rapida',
    mejor_precio: 'Mejor precio posible',
    transparencia:'Proceso transparente',
    legal:        'Seguridad legal',
    admin:        'Administracion profesional',
    compradores:  'Compradores calificados',
    parcial:      'Posibilidad de vender parcialmente',
    impacto:      'Impacto social real',
  },
  preocupaciones: {
    legal:         'La seguridad legal',
    compradores:   'El perfil de los compradores',
    uso_compartido:'El uso compartido de la propiedad',
    mantenimiento: 'El mantenimiento',
    precio:        'El precio de venta',
    tiempo:        'El tiempo de venta',
    impacto:       'La transparencia del impacto social',
    ninguna:       'No tengo preocupaciones por ahora',
  },
  firmarAcuerdo: {
    si:         'Si',
    si_llamada: 'Si, despues de una llamada',
    tal_vez:    'Tal vez',
    no:         'No por ahora',
  },
  contactoAsesor: {
    urgente: 'Si, lo antes posible',
    semana:  'Si, esta semana',
    whatsapp:'Si, solo por WhatsApp',
    correo:  'Prefiero informacion por correo',
  },
};

function tr(field: string, value: any): string {
  if (!value || value === '' || (Array.isArray(value) && value.length === 0)) return '—';
  if (Array.isArray(value)) return value.map(v => T[field]?.[v] ?? v).join(' · ') || '—';
  return T[field]?.[value] ?? String(value);
}

function esc(str: any): string {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}

// ── Fetch logo ────────────────────────────────────────────────────────────────
async function fetchLogo(): Promise<Buffer | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ── Lead score label ──────────────────────────────────────────────────────────
function leadLabel(score: string): string {
  if (score === 'A') return 'Lead A — Alta prioridad';
  if (score === 'B') return 'Lead B — Prioridad media';
  return 'Lead C — Seguimiento normal';
}

// ── Generador PDF ─────────────────────────────────────────────────────────────
async function generatePDF(data: any, nombre: string, leadScore: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const logoBuffer = await fetchLogo();
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const bufs: Buffer[] = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const C = {
      navy:     '#0B1629',
      navyMid:  '#132040',
      blue:     '#1A56DB',
      blueSoft: '#EBF0FF',
      accent:   '#3B82F6',
      green:    '#059669',
      greenBg:  '#ECFDF5',
      greenLine:'#6EE7B7',
      gold:     '#D97706',
      goldBg:   '#FFFBEB',
      goldLine: '#FCD34D',
      text:     '#111827',
      textSoft: '#6B7280',
      line:     '#E5E7EB',
      white:    '#FFFFFF',
      pageBg:   '#F7F9FC',
    };

    const W      = 595.28;
    const H_PAGE = 841.89;
    const ML     = 44;
    const MR     = 44;
    const COL    = W - ML - MR;
    const FOOTER = 30;
    const SAFE   = H_PAGE - FOOTER - 12;
    let y        = 0;
    let rowToggle = false;

    const paintPageBg = () => doc.rect(0, 0, W, H_PAGE).fill(C.pageBg);

    const drawPageHeader = () => {
      doc.rect(0, 0, W, 36).fill(C.navy);
      if (logoBuffer) { try { doc.image(logoBuffer, ML, 8, { height: 20 }); } catch {} }
      doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
         .text('EGOA Capital S.A.C.  |  Evaluacion de Propiedad  |  Confidencial', 0, 14, { width: W, align: 'center' });
      doc.rect(0, 36, W, 2).fill(C.green);
      y = 48;
    };

    const checkBreak = (need: number) => {
      if (y + need > SAFE) {
        doc.addPage();
        paintPageBg();
        drawPageHeader();
        rowToggle = false;
      }
    };

    const section = (title: string) => {
      checkBreak(44);
      const SH = 26;
      doc.rect(ML, y, COL, SH).fill(C.green);
      doc.rect(ML, y, 4, SH).fill(C.goldLine);
      doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold')
         .text(title.toUpperCase(), ML + 14, y + 9, { width: COL - 20, characterSpacing: 0.6 });
      y += SH + 2;
      rowToggle = false;
    };

    const ROW_H = 19;
    const field = (label: string, value: any, translated?: string) => {
      const val = translated ?? String(value ?? '');
      if (!val || val === 'undefined') return;
      checkBreak(ROW_H);
      const bg = rowToggle ? C.blueSoft : C.white;
      rowToggle = !rowToggle;
      doc.rect(ML, y, COL, ROW_H).fill(bg);
      const labelW = COL * 0.42;
      doc.rect(ML + labelW, y, 1, ROW_H).fill(C.line);
      doc.fontSize(8).fillColor(C.textSoft).font('Helvetica')
         .text(label, ML + 10, y + 5.5, { width: labelW - 14, ellipsis: true });
      doc.fontSize(8.2).fillColor(C.text).font('Helvetica-Bold')
         .text(val, ML + labelW + 10, y + 5.5, { width: COL - labelW - 16, ellipsis: true });
      doc.rect(ML, y + ROW_H - 0.5, COL, 0.5).fill(C.line);
      y += ROW_H;
    };

    const gap = (n = 10) => { y += n; };

    // ── PORTADA ───────────────────────────────────────────────────────────────
    paintPageBg();
    doc.rect(0, 0, W, 160).fill(C.navy);
    doc.rect(0, 158, W, 3).fill(C.green);

    if (logoBuffer) { try { doc.image(logoBuffer, ML, 20, { height: 44 }); } catch {} }

    doc.fontSize(20).fillColor(C.white).font('Helvetica-Bold')
       .text('Evaluacion de Propiedad', 0, 24, { align: 'center', width: W });
    doc.fontSize(8.5).fillColor('#6EE7B7').font('Helvetica')
       .text('EGOA Capital S.A.C.  |  RUC 20613300997  |  Documento Confidencial', 0, 50, { align: 'center', width: W });

    // Tarjeta del propietario
    doc.rect(ML + 3, 77, COL, 72).fill('#D1D5DB');
    doc.rect(ML, 74, COL, 72).fill(C.white);
    doc.rect(ML, 74, 5, 72).fill(C.green);

    const initials = nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const cx = ML + 38, cy = 110;
    doc.circle(cx, cy, 22).fill(C.green);
    doc.fontSize(13).fillColor(C.white).font('Helvetica-Bold')
       .text(initials, cx - 22, cy - 9, { width: 44, align: 'center' });

    const tx = ML + 72;
    doc.fontSize(14).fillColor(C.text).font('Helvetica-Bold')
       .text(nombre, tx, 82, { width: COL - 80 });
    doc.fontSize(9).fillColor(C.textSoft).font('Helvetica')
       .text(data.correo ?? '', tx, 100, { width: COL - 80 });
    if (data.ubicacionZona) {
      doc.fontSize(8.5).fillColor(C.green).font('Helvetica-Bold')
         .text(`Zona: ${data.ubicacionZona}`, tx, 116, { width: COL - 80 });
    }
    const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.fontSize(8).fillColor(C.textSoft).font('Helvetica')
       .text(`Fecha de recepcion: ${fecha}`, tx, data.ubicacionZona ? 130 : 116, { width: COL - 80 });

    y = 168;

    // Badge lead score
    gap(8);
    const lsBg  = leadScore === 'A' ? '#ECFDF5' : leadScore === 'B' ? C.goldBg : '#F1F5F9';
    const lsBdr = leadScore === 'A' ? C.green    : leadScore === 'B' ? C.gold    : '#64748B';
    const lsTxt = leadScore === 'A' ? '#065F46'  : leadScore === 'B' ? '#92400E' : '#374151';
    doc.rect(ML, y, COL, 26).fill(lsBg);
    doc.rect(ML, y, 4, 26).fill(lsBdr);
    doc.fontSize(8).fillColor(lsTxt).font('Helvetica-Bold')
       .text(leadLabel(leadScore).toUpperCase(), ML + 14, y + 9, { width: COL * 0.5 });
    doc.fontSize(8).fillColor(lsTxt).font('Helvetica')
       .text(`Recibida: ${fecha}`, ML + COL * 0.55, y + 9, { width: COL * 0.4, align: 'right' });
    y += 34;
    gap(4);

    // ── SECCIONES — todos los campos siempre visibles ─────────────────────────

    section('1. Datos del Propietario');
    field('Nombre completo',       data.nombre);
    field('Celular',               data.celular);
    field('Correo',                data.correo);
    field('Email (usuario auth)',  data.email);
    field('Tipo de propiedad',     '', tr('tipoPropiedad',  data.tipoPropiedad));
    field('Quien decide la venta', '', tr('quienDecide',    data.quienDecide));
    gap();

    section('2. Informacion de la Propiedad');
    field('Zona / Ubicacion',     '', tr('ubicacionZona',   data.ubicacionZona));
    field('Detalle de ubicacion', data.ubicacionDetalle);
    field('Tipo de inmueble',     '', tr('tipoInmueble',    data.tipoInmueble));
    field('Area del terreno',     '', tr('areaTerreno',     data.areaTerreno));
    field('Area construida',      '', tr('areaConstruida',  data.areaConstruida));
    field('Dormitorios',          data.dormitorios || '—');
    field('Caracteristicas',      '', tr('caracteristicas', data.caracteristicas));
    gap();

    section('3. Estado Legal');
    field('Inscrita en Registros Publicos',    '', tr('inscritaRegistros', data.inscritaRegistros));
    field('Tiene cargas o gravamenes',         '', tr('tieneCargas',       data.tieneCargas));
    field('Documentos en orden',               '', tr('documentosOrden',   data.documentosOrden));
    field('Estado de ocupacion',               '', tr('estadoOcupacion',   data.estadoOcupacion));
    field('Material / documentos disponibles', '', tr('tieneMaterial',     data.tieneMaterial));
    gap();

    section('4. Intencion de Venta');
    field('Opcion de venta',             '', tr('opcionVenta',        data.opcionVenta));
    field('Porcentaje a conservar',      '', tr('porcentajeConservar',data.porcentajeConservar));
    field('Motivo de venta',             '', tr('motivoVenta',        data.motivoVenta));
    field('Plazo de venta',              '', tr('plazoVenta',         data.plazoVenta));
    field('Valor estimado (propietario)',data.valorEstimado ? `US$ ${data.valorEstimado}` : '—');
    field('Acepta tasacion profesional', '', tr('aceptaTasacion',     data.aceptaTasacion));
    gap();

    section('5. Uso Posterior');
    field('Desea seguir usando',       '', tr('seguirUsando',        data.seguirUsando));
    field('Dias de uso al ano',        '', tr('diasUso',             data.diasUso));
    field('Dispuesto a compartir uso', '', tr('compartirUso',        data.compartirUso));
    field('Que desea conservar',       '', tr('importanteConservar', data.importanteConservar));
    gap();

    section('6. Impacto Social');
    field('Importancia del impacto',          '', tr('importanciaImpacto', data.importanciaImpacto));
    field('Contribuir con vivienda social',   '', tr('contribuirVivienda', data.contribuirVivienda));
    field('Tipo de causa preferida',          '', tr('tipoCausa',          data.tipoCausa));
    field('Acepta que se cuente su historia', '', tr('aceptarHistoria',    data.aceptarHistoria));
    gap();

    section('7. Expectativas y Cierre');
    field('Expectativas del proceso',      '', tr('expectativas',   data.expectativas));
    field('Preocupaciones',                '', tr('preocupaciones', data.preocupaciones));
    field('Dispuesto a firmar acuerdo',    '', tr('firmarAcuerdo',  data.firmarAcuerdo));
    field('Preferencia de contacto',       '', tr('contactoAsesor', data.contactoAsesor));
    gap(14);

    // Nota legal
    checkBreak(48);
    doc.rect(ML, y, COL, 40).fill('#F1F5F9');
    doc.rect(ML, y, 2, 40).fill(C.accent);
    doc.fontSize(7.5).fillColor(C.textSoft).font('Helvetica')
       .text(
         'Este documento es de caracter confidencial y ha sido generado automaticamente por el sistema de evaluacion de EGOA Capital S.A.C. ' +
         'La informacion sera tratada conforme a la politica de privacidad de la empresa y la normativa vigente.',
         ML + 10, y + 8, { width: COL - 16, lineGap: 2 }
       );
    y += 48;

    // ── FOOTER todas las páginas ──────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, H_PAGE - FOOTER - 1, W, 1).fill(C.line);
      doc.rect(0, H_PAGE - FOOTER, W, FOOTER).fill(C.navy);
      const footerY = H_PAGE - FOOTER + 10;
      doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
         .text('EGOA Capital S.A.C.  |  RUC 20613300997  |  operaciones@egoa.app  |  958 540 663', ML, footerY, { width: COL * 0.7 });
      doc.fontSize(7).fillColor('#94A3B8').font('Helvetica-Bold')
         .text(`Pagina ${i + 1} de ${totalPages}`, ML, footerY, { width: COL, align: 'right' });
    }

    doc.end();
  });
}

// ── Email al admin ────────────────────────────────────────────────────────────
function buildAdminEmail(data: any, nombre: string, leadScore: string): string {
  const lsColor = leadScore === 'A' ? '#059669' : leadScore === 'B' ? '#D97706' : '#64748B';
  const lsLabel = leadLabel(leadScore);
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:20px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:560px;margin:0 auto">
      <div style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:60px;margin-bottom:14px" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Nueva evaluacion de propiedad</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">Pendiente de revision por el equipo EGOA</p>
      </div>

      <div style="background:#065F46;padding:16px 24px">
        <p style="margin:0;font-size:17px;font-weight:700;color:#fff">${esc(nombre)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6EE7B7">${esc(data.correo ?? '')}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#A7F3D0">Zona: ${esc(data.ubicacionZona ?? '—')}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#6EE7B7">${fecha}</p>
      </div>

      <div style="background:#fff;padding:28px 24px">
        <p style="font-size:15px;color:#111827;margin:0 0 12px">Hola equipo,</p>
        <p style="font-size:14px;color:#4B5563;line-height:1.6;margin:0 0 20px">
          Se ha recibido una nueva solicitud de evaluacion de propiedad de <strong>${esc(nombre)}</strong>.
          El detalle completo se encuentra en el <strong>PDF adjunto</strong>.
        </p>

        <div style="background:#F0FDF4;border-radius:10px;padding:16px;border:1px solid #BBF7D0;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.5px">Resumen rapido</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280;width:45%">Nombre</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(nombre)}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Celular</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(data.celular ?? '—')}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Correo</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(data.correo ?? '—')}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Zona</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(data.ubicacionZona ?? '—')}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Tipo inmueble</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(tr('tipoInmueble', data.tipoInmueble))}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Plazo de venta</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827">${esc(tr('plazoVenta', data.plazoVenta))}</td></tr>
            <tr><td style="padding:5px 0;font-size:13px;color:#6B7280">Lead Score</td><td style="padding:5px 0;font-size:13px;font-weight:700;color:${lsColor}">${esc(lsLabel)}</td></tr>
          </table>
        </div>

        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:12px 16px">
          <p style="margin:0;font-size:12px;color:#92400E">
            <strong>Estado:</strong> Pendiente de revision &nbsp;·&nbsp; Recibida el ${fecha}
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#92400E">Ver todos los detalles en el <strong>PDF adjunto</strong>.</p>
        </div>
      </div>

      <div style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · operaciones@egoa.app · 958 540 663</p>
      </div>
    </div>
  </body></html>`;
}

// ── Email al propietario ──────────────────────────────────────────────────────
function buildOwnerEmail(nombre: string, zona?: string): string {
  const first = esc(nombre.trim().split(' ')[0]);
  const zonaLine = zona
    ? `<p style="font-size:13px;color:#4B5563;margin:0 0 16px">Propiedad evaluada en: <strong style="color:#065F46">${esc(zona)}</strong></p>`
    : '';

  const steps = [
    'Tu solicitud de evaluacion fue recibida correctamente.',
    'Nuestro equipo revisara tu propiedad en las proximas <strong>48 horas habiles</strong>.',
    'Te contactaremos con una valoracion preliminar y los proximos pasos.',
    'Si hay un match con nuestra cartera, te presentaremos una propuesta formal.',
  ];

  return `<!DOCTYPE html><html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:540px;margin:20px auto; }
    @media only screen and (max-width:600px) { .wrap { margin:0 !important; } }
  </style></head>
  <body>
    <div class="wrap">
      <div style="background:#0F172A;padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="EGOA" style="max-height:60px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto" onerror="this.style.display='none'"/>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Evaluacion recibida</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px">EGOA Capital · Proceso de evaluacion de propiedad</p>
      </div>

      <div style="background:#fff;padding:28px 20px">
        <p style="font-size:16px;color:#111827;margin:0 0 8px">Hola <strong>${first}</strong>,</p>
        <p style="font-size:14px;color:#4B5563;line-height:1.6;margin:0 0 16px">
          Tu solicitud de evaluacion de propiedad en <strong>EGOA Capital</strong> ha sido recibida.
          Adjunto encontraras el PDF con el resumen de los datos que nos compartiste.
        </p>
        ${zonaLine}

        <div style="background:#F0FDF4;border-radius:10px;padding:18px;border:1px solid #BBF7D0;margin-bottom:20px">
          <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.5px">Que sigue ahora?</p>
          ${steps.map((text, i) => `
            <div style="display:flex;align-items:flex-start;margin-bottom:${i < steps.length - 1 ? '12px' : '0'}">
              <div style="min-width:24px;height:24px;border-radius:50%;background:#059669;color:#fff;font-size:11px;font-weight:700;line-height:24px;text-align:center;margin-right:12px;flex-shrink:0">${i + 1}</div>
              <p style="margin:0;font-size:13px;color:#065F46;line-height:1.5;padding-top:3px">${text}</p>
            </div>
          `).join('')}
        </div>

        <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;border:1px solid #BBF7D0">
          <p style="margin:0;font-size:13px;color:#14532D">
            Tienes alguna pregunta? Escribenos a
            <a href="mailto:operaciones@egoa.app" style="color:#059669;font-weight:600">operaciones@egoa.app</a>
            o llamanos al <strong>958 540 663</strong>.
          </p>
        </div>
      </div>

      <div style="background:#0F172A;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#94A3B8">EGOA Capital S.A.C. · RUC 20613300997 · Lima, Peru</p>
      </div>
    </div>
  </body></html>`;
}

// ── Clasificación de lead ─────────────────────────────────────────────────────
function classifyLead(body: any): 'A' | 'B' | 'C' {
  let score = 0;
  if (['casa_playa', 'casa_campo', 'departamento_lujo'].includes(body.tipoInmueble)) score += 3;
  if (body.documentosOrden === 'si')      score += 2;
  if (body.inscritaRegistros === 'si')    score += 1;
  if (body.tieneCargas === 'no')          score += 1;
  if (['100', 'parcial', 'ambas'].includes(body.opcionVenta)) score += 2;
  if (['urgente', '1-3m'].includes(body.plazoVenta))          score += 2;
  if (['si', 'si_info'].includes(body.aceptaTasacion))        score += 1;
  if (['si', 'si_info'].includes(body.contribuirVivienda))    score += 1;
  if (['urgente', 'semana', 'whatsapp'].includes(body.contactoAsesor)) score += 1;
  if (score >= 9) return 'A';
  if (score >= 5) return 'B';
  return 'C';
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const leadScore = classifyLead(body);
    const nombre = body.nombre || 'Propietario';

    // 1. Guardar en BD (fix: emailAuth en camelCase para Drizzle)
    const [inserted] = await db.insert(sellEvaluations).values({
      nombre:              body.nombre            ?? '',
      celular:             body.celular           ?? '',
      correo:              body.correo            ?? '',
      emailAuth:           body.email             ?? null,   // ← camelCase, no email_auth
      tipoPropiedad:       body.tipoPropiedad     ?? '',
      quienDecide:         body.quienDecide       ?? '',
      ubicacionZona:       body.ubicacionZona     ?? '',
      ubicacionDetalle:    body.ubicacionDetalle  ?? '',
      tipoInmueble:        body.tipoInmueble      ?? '',
      areaTerreno:         body.areaTerreno       ?? '',
      areaConstruida:      body.areaConstruida    ?? '',
      dormitorios:         body.dormitorios       ?? '',
      caracteristicas:     body.caracteristicas   ?? [],
      inscritaRegistros:   body.inscritaRegistros ?? '',
      tieneCargas:         body.tieneCargas       ?? '',
      documentosOrden:     body.documentosOrden   ?? '',
      estadoOcupacion:     body.estadoOcupacion   ?? '',
      tieneMaterial:       body.tieneMaterial     ?? [],
      opcionVenta:         body.opcionVenta       ?? '',
      porcentajeConservar: body.porcentajeConservar ?? '',
      motivoVenta:         body.motivoVenta       ?? [],
      plazoVenta:          body.plazoVenta        ?? '',
      valorEstimado:       body.valorEstimado     ?? '',
      aceptaTasacion:      body.aceptaTasacion    ?? '',
      seguirUsando:        body.seguirUsando      ?? '',
      diasUso:             body.diasUso           ?? '',
      compartirUso:        body.compartirUso      ?? '',
      importanteConservar: body.importanteConservar ?? '',
      importanciaImpacto:  body.importanciaImpacto ?? '',
      contribuirVivienda:  body.contribuirVivienda ?? '',
      tipoCausa:           body.tipoCausa         ?? '',
      aceptarHistoria:     body.aceptarHistoria   ?? '',
      expectativas:        body.expectativas      ?? [],
      preocupaciones:      body.preocupaciones    ?? '',
      firmarAcuerdo:       body.firmarAcuerdo     ?? '',
      contactoAsesor:      body.contactoAsesor    ?? '',
      leadScore,
    }).returning();

    // 2. Generar PDF
    const pdfBuffer = await generatePDF(body, nombre, leadScore);
    const pdfFilename = `evaluacion_${nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    // 3. Transporter
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const attachment = [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }];

    // 4. Email al admin
    await transporter.sendMail({
      from:        `"EGOA Capital" <${process.env.SMTP_USER}>`,
      to:          ADMIN_EMAIL,
      bcc:         YOUR_EMAIL,
      subject:     `Nueva evaluacion de propiedad — ${nombre} [Lead ${leadScore}]`,
      html:        buildAdminEmail(body, nombre, leadScore),
      attachments: attachment,
    });

    // 5. Email al propietario (usa body.correo, no body.email)
    const correoDestino = body.correo || body.email;
    if (correoDestino?.includes('@')) {
      await transporter.sendMail({
        from:        `"EGOA Capital" <${process.env.SMTP_USER}>`,
        to:          correoDestino,
        subject:     'Tu evaluacion de propiedad fue recibida — EGOA Capital',
        html:        buildOwnerEmail(nombre, body.ubicacionZona),
        attachments: attachment,
      });
    }

    return res.status(201).json({ ok: true, id: inserted.id, lead_score: leadScore });

  } catch (err) {
    console.error('sell-evaluation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}