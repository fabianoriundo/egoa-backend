// api-backend/schema.ts
import { pgTable, serial, text, timestamp, integer, real, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  sublocation: text('sublocation'),
  descripcion: text('descripcion'),
  totalInversion: integer('total_inversion').notNull(),
  precioEgoa: integer('precio_egoa').notNull(),
  habs: integer('habs').notNull(),
  banos: integer('banos').notNull(),
  m2: real('m2').notNull(),
  totalTokens: integer('total_tokens').notNull().default(8),
  tokenesVendidos: integer('tokenes_vendidos').notNull().default(0),
  rentabilidadAnual: real('rentabilidad_anual'),
  distribuido: integer('distribuido'),
  fechaAlquiler: text('fecha_alquiler').notNull(),
  hueA: integer('hue_a'),
  hueB: integer('hue_b'),
  badge: text('badge'),
  status: text('status').notNull().default('disponible'),
  createdAt: timestamp('created_at').defaultNow(),
  tipo: text('tipo').default('playa'),
  categoria: text('categoria').default('vacacional'),
  estilo: text('estilo').default('moderno'),
  modelo: text('modelo'),
  financiamiento: boolean('financiamiento').default(false),
  petFriendly: boolean('pet_friendly').default(false),
  // ← Campo de imágenes S3
  images: text('images').array(),
});