// api-backend/schema.ts
import { pgTable, serial, text, timestamp, integer, real } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),

  // Identidad
  code: text('code').notNull(),           // 'EGT-MRM-01'
  name: text('name').notNull(),           // 'Flat Miramar'
  location: text('location').notNull(),   // 'San Bartolo, Lima, Perú'
  sublocation: text('sublocation'),       // 'Condominio Miramar · frente al mar'
  descripcion: text('descripcion'),

  // Precios
  totalInversion: integer('total_inversion').notNull(),  // precio total
  precioEgoa: integer('precio_egoa').notNull(),          // precio de 1/8

  // Características
  habs: integer('habs').notNull(),
  banos: integer('banos').notNull(),
  m2: real('m2').notNull(),

  // Tokens
  totalTokens: integer('total_tokens').notNull().default(8),
  tokenesVendidos: integer('tokenes_vendidos').notNull().default(0),

  // Rentabilidad (null = restringido)
  rentabilidadAnual: real('rentabilidad_anual'),
  distribuido: integer('distribuido'),

  // Fechas
  fechaAlquiler: text('fecha_alquiler').notNull(),   // 'DD/MM/YYYY'

  // Visual
  hueA: integer('hue_a'),
  hueB: integer('hue_b'),
  badge: text('badge'),   // 'Nuevo' | 'Sold out' | 'Match 92%' | null

  // Estado
  status: text('status').notNull().default('disponible'), // 'disponible' | 'agotado' | 'proximamente'

  createdAt: timestamp('created_at').defaultNow(),
});