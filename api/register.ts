import { db } from '../db';
import { users } from '../schema';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { fullName, email, password } = req.body;

  try {
    // 1. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Insertar en Neon
    await db.insert(users).values({
      fullName,
      email,
      password: hashedPassword
    });

    res.status(200).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
}