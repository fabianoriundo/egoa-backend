// api-backend/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(), // Aquí guardaremos el hash (encriptado)
  createdAt: timestamp('created_at').defaultNow(),
});