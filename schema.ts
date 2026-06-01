// api-backend/schema.ts — completo con tabla invites agregada
import {
  pgTable, pgEnum,
  serial, text, timestamp, integer, real, boolean,jsonb,
} from 'drizzle-orm/pg-core';

// ── Tabla existente: users ────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:        serial('id').primaryKey(),
  fullName:  text('full_name').notNull(),
  email:     text('email').unique().notNull(),
  password:  text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── Tabla existente: properties ───────────────────────────────────────────────
export const properties = pgTable('properties', {
  id:                serial('id').primaryKey(),
  code:              text('code').notNull(),
  name:              text('name').notNull(),
  location:          text('location').notNull(),
  sublocation:       text('sublocation'),
  descripcion:       text('descripcion'),
  totalInversion:    integer('total_inversion').notNull(),
  precioEgoa:        integer('precio_egoa').notNull(),
  habs:              integer('habs').notNull(),
  banos:             integer('banos').notNull(),
  m2:                real('m2').notNull(),
  totalTokens:       integer('total_tokens').notNull().default(8),
  tokenesVendidos:   integer('tokenes_vendidos').notNull().default(0),
  rentabilidadAnual: real('rentabilidad_anual'),
  distribuido:       integer('distribuido'),
  fechaAlquiler:     text('fecha_alquiler').notNull(),
  hueA:              integer('hue_a'),
  hueB:              integer('hue_b'),
  badge:             text('badge'),
  status:            text('status').notNull().default('disponible'),
  createdAt:         timestamp('created_at').defaultNow(),
  tipo:              text('tipo').default('playa'),
  categoria:         text('categoria').default('vacacional'),
  estilo:            text('estilo').default('moderno'),
  modelo:            text('modelo'),
  financiamiento:    boolean('financiamiento').default(false),
  petFriendly:       boolean('pet_friendly').default(false),
  images:            text('images').array(),
  lat:               real('lat'),
  lng:               real('lng'),
});

// ── NUEVO: enum + tabla invites ───────────────────────────────────────────────
export const inviteStatusEnum = pgEnum('invite_status', [
  'pendiente',
  'en_calificacion',
  'aprobado',
  'rechazado',
]);

export const invites = pgTable('invites', {
  id:           serial('id').primaryKey(),
  inviterId:    integer('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedName:  text('invited_name'),
  invitedEmail: text('invited_email').notNull(),
  status:       inviteStatusEnum('status').notNull().default('pendiente'),
  detail:       text('detail'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

export const sellEvaluations = pgTable('sell_evaluations', {
  id:                 serial('id').primaryKey(),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  // 1. Datos del propietario
  nombre:             text('nombre').notNull().default(''),
  celular:            text('celular').notNull().default(''),
  correo:             text('correo').notNull().default(''),
  emailAuth:          text('email_auth'),
  tipoPropiedad:      text('tipo_propiedad').notNull().default(''),
  quienDecide:        text('quien_decide').notNull().default(''),

  // 2. Información de la propiedad
  ubicacionZona:      text('ubicacion_zona').notNull().default(''),
  ubicacionDetalle:   text('ubicacion_detalle').notNull().default(''),
  tipoInmueble:       text('tipo_inmueble').notNull().default(''),
  areaTerreno:        text('area_terreno').notNull().default(''),
  areaConstruida:     text('area_construida').notNull().default(''),
  dormitorios:        text('dormitorios').notNull().default(''),
  caracteristicas:    jsonb('caracteristicas').notNull().default([]),

  // 3. Estado legal
  inscritaRegistros:  text('inscrita_registros').notNull().default(''),
  tieneCargas:        text('tiene_cargas').notNull().default(''),
  documentosOrden:    text('documentos_orden').notNull().default(''),
  estadoOcupacion:    text('estado_ocupacion').notNull().default(''),
  tieneMaterial:      jsonb('tiene_material').notNull().default([]),

  // 4. Intención de venta
  opcionVenta:        text('opcion_venta').notNull().default(''),
  porcentajeConservar: text('porcentaje_conservar').notNull().default(''),
  motivoVenta:        jsonb('motivo_venta').notNull().default([]),
  plazoVenta:         text('plazo_venta').notNull().default(''),
  valorEstimado:      text('valor_estimado').notNull().default(''),
  aceptaTasacion:     text('acepta_tasacion').notNull().default(''),

  // 5. Uso posterior
  seguirUsando:       text('seguir_usando').notNull().default(''),
  diasUso:            text('dias_uso').notNull().default(''),
  compartirUso:       text('compartir_uso').notNull().default(''),
  importanteConservar: text('importante_conservar').notNull().default(''),

  // 6. Impacto social
  importanciaImpacto: text('importancia_impacto').notNull().default(''),
  contribuirVivienda: text('contribuir_vivienda').notNull().default(''),
  tipoCausa:          text('tipo_causa').notNull().default(''),
  aceptarHistoria:    text('aceptar_historia').notNull().default(''),

  // 7. Expectativas
  expectativas:       jsonb('expectativas').notNull().default([]),
  preocupaciones:     text('preocupaciones').notNull().default(''),
  firmarAcuerdo:      text('firmar_acuerdo').notNull().default(''),
  contactoAsesor:     text('contacto_asesor').notNull().default(''),

  // Clasificación interna
  leadScore:          text('lead_score').notNull().default('C'),
});

export type SellEvaluationInsert = typeof sellEvaluations.$inferInsert;
export type SellEvaluationSelect = typeof sellEvaluations.$inferSelect;

export const propertyPois = pgTable('property_pois', {
  id:          serial('id').primaryKey(),
  propertyId:  integer('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  categoria:   text('categoria').notNull(),
  emoji:       text('emoji').notNull(),
  lat:         real('lat').notNull(),
  lng:         real('lng').notNull(),
  distanciaM:  integer('distancia_m'),
  descripcion: text('descripcion'),
  createdAt:   timestamp('created_at').defaultNow(),
});
 
export type PoiSelect = typeof propertyPois.$inferSelect;