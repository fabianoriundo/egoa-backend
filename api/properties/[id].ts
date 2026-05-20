// api/properties/[id].ts  — Detalle de una propiedad por id
import { db } from '../../db';
import { properties } from '../../schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    if (result.length === 0) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.status(200).json(result[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}