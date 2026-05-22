// back/api/auth/google.ts
import { db } from '../../db';
import { users } from '../../schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

interface GoogleTokenInfo {
  email: string;
  name: string;
  sub: string;
  error?: string;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Token requerido' });

  try {
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    const googleData = await googleRes.json() as GoogleTokenInfo;

    if (!googleRes.ok || googleData.error) {
      return res.status(401).json({ error: 'Token de Google inválido' });
    }

    const { email, name, sub: googleId } = googleData;
    if (!email) return res.status(400).json({ error: 'No se pudo obtener el email' });

    let result = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (result.length === 0) {
      const inserted = await db.insert(users).values({
        fullName: name ?? email.split('@')[0],
        email,
        password: `google_${googleId}`,
      }).returning();
      result = inserted;
    }

    const user = result[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'egoa_jwt_secret',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      message: 'Login con Google exitoso',
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}