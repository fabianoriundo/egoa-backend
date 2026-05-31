// back/api/invites.ts
// GET  /api/invites          → devuelve invitaciones del usuario autenticado
// POST /api/invites          → crea una nueva invitación
// Autenticación: Bearer JWT  (mismo JWT que genera /api/auth/google.ts)

import { db } from '../db';
import { invites, users } from '../schema';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'egoa_jwt_secret';
const TOTAL_SLOTS = 7; // máximo de invitaciones por usuario

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUserIdFromRequest(req: any): number | null {
  const auth = req.headers?.authorization as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: number };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  // ── GET — lista de invitaciones del usuario ────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await db
        .select()
        .from(invites)
        .where(eq(invites.inviterId, userId))
        .orderBy(invites.createdAt);

      return res.status(200).json(rows);
    } catch (err) {
      console.error('GET /api/invites error:', err);
      return res.status(500).json({ error: 'Error al obtener invitaciones' });
    }
  }

  // ── POST — crear nueva invitación ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { invitedName, invitedEmail } = req.body ?? {};

    if (!invitedEmail || typeof invitedEmail !== 'string') {
      return res.status(400).json({ error: 'El email del invitado es requerido' });
    }

    try {
      // Verificar slots disponibles
      const existing = await db
        .select()
        .from(invites)
        .where(eq(invites.inviterId, userId));

      if (existing.length >= TOTAL_SLOTS) {
        return res.status(409).json({ error: 'Has alcanzado el límite de invitaciones' });
      }

      // Verificar que el email no haya sido ya invitado por este usuario
      const duplicate = existing.find(
        (i) => i.invitedEmail.toLowerCase() === invitedEmail.toLowerCase()
      );
      if (duplicate) {
        return res.status(409).json({ error: 'Ya enviaste una invitación a ese email' });
      }

      const [newInvite] = await db
        .insert(invites)
        .values({
          inviterId: userId,
          invitedName: invitedName?.trim() || null,
          invitedEmail: invitedEmail.trim().toLowerCase(),
          status: 'pendiente',
        })
        .returning();

      return res.status(201).json(newInvite);
    } catch (err) {
      console.error('POST /api/invites error:', err);
      return res.status(500).json({ error: 'Error al crear la invitación' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}