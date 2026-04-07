import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../config/env';

export const signup = async (req: Request, res: Response) => {
  try {
    const username = req.headers['username'] as string;
    const password = req.headers['password'] as string;
    if (!username || !password) return res.status(400).json({ mes: 'Username and password required' });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.json({ mes: false });

    const newUser = new User({ username, password });
    await newUser.save();
    res.json({ mes: true });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const signin = async (req: Request, res: Response) => {
  try {
    const username = req.headers['username'] as string;
    const password = req.headers['password'] as string;
    if (!username || !password) return res.status(400).json({ mes: 'Username and password required' });

    const existingUser = await User.findOne({ username, password });
    if (existingUser) {
      const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: '1h' });
      return res.json({ mes: 'true', jwttoken: token });
    }
    return res.json({ mes: 'false' });
  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
