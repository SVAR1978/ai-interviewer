import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../config/env';

export const signup = async (req: Request, res: Response) => {
  try {
    const fullName = (req.body.fullName || req.headers['fullname'] || '') as string;
    const email = (req.body.email || req.headers['email'] || '') as string;
    const password = (req.body.password || req.headers['password'] || '') as string;
    const agreedToTerms = req.body.agreedToTerms !== undefined ? req.body.agreedToTerms : true;
    let username = (req.body.username || req.headers['username'] || '') as string;

    if (!fullName || !email || !password) {
      return res.status(400).json({ mes: false, error: 'Full name, email, and password are required' });
    }

    if (!agreedToTerms) {
      return res.status(400).json({ mes: false, error: 'You must agree to the Terms & Conditions' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ mes: false, error: 'This email is already registered. Please sign in.' });
    }

    // Determine unique username
    if (!username) {
      username = fullName.trim();
    }
    let finalUsername = username;
    const existingUsername = await User.findOne({ username: finalUsername });
    if (existingUsername) {
      finalUsername = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const newUser = new User({
      fullName: fullName.trim(),
      username: finalUsername,
      email: cleanEmail,
      password,
      agreedToTerms: Boolean(agreedToTerms),
      createdAt: new Date(),
    });
    await newUser.save();

    res.json({ mes: true, message: 'Account created successfully' });
  } catch (error: any) {
    console.error('Signup Error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ mes: false, error: 'Email or username already exists' });
    }
    res.status(500).json({ mes: false, error: 'Internal server error' });
  }
};

export const signin = async (req: Request, res: Response) => {
  try {
    const loginIdentifier = (req.body.identifier || req.body.username || req.body.email || req.headers['username']) as string;
    const password = (req.body.password || req.headers['password']) as string;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ mes: 'Username or email and password required' });
    }

    const cleanId = loginIdentifier.trim();

    // Match by either username or email
    const existingUser = await User.findOne({
      $or: [
        { username: cleanId },
        { email: cleanId.toLowerCase() }
      ],
      password
    });

    if (existingUser) {
      const token = jwt.sign({ username: existingUser.username }, config.jwtSecret, { expiresIn: '7d' });
      return res.json({
        mes: 'true',
        jwttoken: token,
        username: existingUser.username,
        fullName: existingUser.fullName,
        email: existingUser.email
      });
    }

    return res.json({ mes: 'false', error: 'Invalid username/email or password' });
  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
