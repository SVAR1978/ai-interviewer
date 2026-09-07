import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, Mail, Lock, KeyRound, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import '../styles/auth.css';

const ForgotPassword: React.FC = () => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [countdown, setCountdown] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        let timer: any;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    // Step 1: Send OTP to email
    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            const data = await api.auth.forgotPassword(cleanEmail);
            if (data.success) {
                setStep(2);
                setSuccessMessage(data.message || 'Verification code sent to your email!');
                setCountdown(60); // 60-second cooldown
            } else {
                setError(data.error || 'Failed to send verification code. Please check your email.');
            }
        } catch {
            setError('Unable to connect to the authentication server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Resend OTP
    const handleResendOTP = async () => {
        if (countdown > 0 || loading) return;
        setError('');
        setSuccessMessage('');
        setLoading(true);
        try {
            const data = await api.auth.forgotPassword(email.trim().toLowerCase());
            if (data.success) {
                setSuccessMessage('A new verification code has been sent!');
                setCountdown(60);
            } else {
                setError(data.error || 'Failed to resend code. Please try again.');
            }
        } catch {
            setError('Server connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Reset Password with OTP
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (otp.trim().length !== 6) {
            setError('Please enter the 6-digit verification code');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const data = await api.auth.resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
            if (data.success) {
                setStep(3);
            } else {
                setError(data.error || 'Invalid or expired code. Please try again.');
            }
        } catch {
            setError('Server connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Animated background */}
            <div className="auth-bg">
                <div className="auth-orb auth-orb-1"></div>
                <div className="auth-orb auth-orb-2"></div>
                <div className="auth-orb auth-orb-3"></div>
                <div className="auth-grid"></div>
            </div>

            {/* Back to Home */}
            <Link to="/" className="auth-back">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Home
            </Link>

            <div className="auth-container">
                {/* Left panel — branding */}
                <div className="auth-brand-panel">
                    <div className="brand-content">
                        <div className="auth-brand-icon">
                            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
                                <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#gAuth)" strokeWidth="2" fill="none"/>
                                <circle cx="14" cy="14" r="5" fill="url(#gAuth)" opacity="0.8"/>
                                <defs>
                                    <linearGradient id="gAuth" x1="2" y1="2" x2="26" y2="26">
                                        <stop stopColor="#818cf8"/>
                                        <stop offset="1" stopColor="#a78bfa"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h1 className="auth-brand-title">InterviewAI</h1>
                        <p className="auth-brand-desc">
                            Recover your account securely. We'll send an OTP directly to your registered email address.
                        </p>
                        <div className="auth-brand-stats">
                            <div className="auth-stat">
                                <span className="auth-stat-num">10K+</span>
                                <span className="auth-stat-lbl">Interviews</span>
                            </div>
                            <div className="auth-stat">
                                <span className="auth-stat-num">95%</span>
                                <span className="auth-stat-lbl">Success</span>
                            </div>
                            <div className="auth-stat">
                                <span className="auth-stat-num" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    4.9 <Star size={14} fill="#f59e0b" color="#f59e0b" />
                                </span>
                                <span className="auth-stat-lbl">Rating</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel — form */}
                <div className="auth-form-panel">
                    <div className="auth-form-inner">
                        {step === 1 && (
                            <>
                                <div className="auth-step-pill">
                                    <KeyRound size={14} /> Step 1 of 2: Verify Email
                                </div>
                                <div className="auth-form-header">
                                    <h2>Forgot Password?</h2>
                                    <p>Enter your registered email address and we will send you a 6-digit OTP.</p>
                                </div>

                                {error && <p className="auth-error">{error}</p>}
                                {successMessage && <p className="auth-success">{successMessage}</p>}

                                <form onSubmit={handleSendOTP} className="auth-form">
                                    <div className="auth-field">
                                        <label htmlFor="reset-email">Email Address</label>
                                        <div className="auth-input-wrap">
                                            <Mail size={18} className="input-icon" />
                                            <input
                                                id="reset-email"
                                                type="email"
                                                required
                                                autoFocus
                                                placeholder="e.g. alex@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" className="auth-submit" disabled={loading}>
                                        {loading ? (
                                            <span className="auth-spinner"></span>
                                        ) : (
                                            <>
                                                Send Verification Code
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="auth-footer-link">
                                    Remember your password? <Link to="/signin">Sign In</Link>
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div className="auth-step-pill">
                                    <Lock size={14} /> Step 2 of 2: Reset Password
                                </div>
                                <div className="auth-form-header">
                                    <h2>Enter Verification Code</h2>
                                    <p>
                                        We sent a 6-digit OTP code to <strong style={{ color: '#fff' }}>{email}</strong>
                                    </p>
                                </div>

                                {error && <p className="auth-error">{error}</p>}
                                {successMessage && <p className="auth-success">{successMessage}</p>}

                                <form onSubmit={handleResetPassword} className="auth-form">
                                    <div className="auth-field">
                                        <label htmlFor="reset-otp">6-Digit Code</label>
                                        <div className="auth-input-wrap">
                                            <KeyRound size={18} className="input-icon" />
                                            <input
                                                id="reset-otp"
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                required
                                                autoFocus
                                                placeholder="------"
                                                className="auth-otp-input"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            />
                                        </div>
                                    </div>

                                    <div className="auth-resend-row">
                                        <button
                                            type="button"
                                            onClick={() => { setStep(1); setError(''); setSuccessMessage(''); }}
                                            className="auth-resend-btn"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <ArrowLeft size={13} /> Change email
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResendOTP}
                                            disabled={countdown > 0 || loading}
                                            className="auth-resend-btn"
                                        >
                                            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                                        </button>
                                    </div>

                                    <div className="auth-field">
                                        <label htmlFor="new-password">New Password</label>
                                        <div className="auth-input-wrap">
                                            <Lock size={18} className="input-icon" />
                                            <input
                                                id="new-password"
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                placeholder="At least 6 characters"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="auth-field">
                                        <label htmlFor="confirm-password">Confirm New Password</label>
                                        <div className="auth-input-wrap">
                                            <Lock size={18} className="input-icon" />
                                            <input
                                                id="confirm-password"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                required
                                                placeholder="Re-enter your new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button type="submit" className="auth-submit" disabled={loading}>
                                        {loading ? (
                                            <span className="auth-spinner"></span>
                                        ) : (
                                            <>
                                                Reset Password
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}

                        {step === 3 && (
                            <div className="auth-success-card">
                                <div className="auth-success-icon">
                                    <CheckCircle2 size={36} />
                                </div>
                                <div className="auth-form-header" style={{ marginBottom: '8px' }}>
                                    <h2>Password Reset!</h2>
                                    <p>Your password has been successfully updated. You can now sign in with your new credentials.</p>
                                </div>
                                <button
                                    type="button"
                                    className="auth-submit"
                                    onClick={() => navigate('/signin')}
                                    style={{ marginTop: '12px' }}
                                >
                                    Proceed to Sign In
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
