// api/properties.ts  — Lista todas las propiedades
import { db } from '../db';
import { properties } from '../schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const all = await db.select().from(properties).orderBy(properties.id);
    res.status(200).json(all);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}