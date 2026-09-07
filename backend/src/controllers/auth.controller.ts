import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, PasswordResetOTP } from '../models';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { emailService } from '../services/email.service';

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

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ username: req.username }).select('fullName username email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      fullName: user.fullName || user.username.replace(/_\d{4,}$/, ''),
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || req.headers['email'] || '') as string;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });

    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'No account found with this email address' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clear previous OTPs for this email and save the new one
    await PasswordResetOTP.deleteMany({ email: cleanEmail });
    const resetDoc = new PasswordResetOTP({
      email: cleanEmail,
      otp,
      expiresAt,
      createdAt: new Date(),
    });
    await resetDoc.save();

    // Send email via Nodemailer worker
    await emailService.sendPasswordResetOTP(cleanEmail, otp);

    return res.json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email address.',
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required' });
    }

    const cleanEmail = (email as string).toLowerCase().trim();
    const cleanOtp = (otp as string).trim();

    const record = await PasswordResetOTP.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    if (new Date() > record.expiresAt) {
      await PasswordResetOTP.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    return res.json({ success: true, message: 'Code verified successfully' });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = (email as string).toLowerCase().trim();
    const cleanOtp = (otp as string).trim();

    const record = await PasswordResetOTP.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    if (new Date() > record.expiresAt) {
      await PasswordResetOTP.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    user.password = newPassword;
    await user.save();

    // Invalidate the OTP after use
    await PasswordResetOTP.deleteMany({ email: cleanEmail });

    return res.json({ success: true, message: 'Password has been reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};
