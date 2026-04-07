import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  username?: string;
}

export const verifyJWT = (token?: string): string | { error: string } => {
  if (!token) {
    return { error: 'Missing token' };
  }
  try {
    const decoded: any = jwt.verify(token, config.jwtSecret);
    return decoded.username;
  } catch (error: any) {
    console.error('JWT Verification Failed:', error.message || error);
    return { error: 'Invalid token' };
  }
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('jwttoken');
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  const verified = verifyJWT(token);
  if (typeof verified === 'object' && 'error' in verified) {
    return res.status(401).json({ error: verified.error });
  }
  req.username = verified;
  next();
};
