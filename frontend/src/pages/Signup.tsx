import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import '../styles/auth.css';

const Signup: React.FC = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Password requirements calculations
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const isPasswordValid = hasMinLength && hasNumber && hasUppercase;
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (!fullName.trim()) {
            return setMessage('Please enter your full name.');
        }

        if (!email.trim() || !email.includes('@')) {
            return setMessage('Please enter a valid email address.');
        }

        if (!isPasswordValid) {
            return setMessage('Please meet all password requirements before signing up.');
        }

        if (password !== confirmPassword) {
            return setMessage('Passwords do not match.');
        }

        if (!agreedToTerms) {
            return setMessage('Please accept the Terms & Conditions and Privacy Policy.');
        }

        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    password,
                    agreedToTerms
                })
            });
            const data = await res.json();
            if (data.mes === true) {
                navigate('/signin');
            } else {
                setMessage(data.error || 'Unable to create account. Please try again.');
            }
        } catch {
            setMessage('Unable to connect to the server. Please try again.');
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

            {/* Back to home */}
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
                                <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#gAuth2)" strokeWidth="2" fill="none"/>
                                <circle cx="14" cy="14" r="5" fill="url(#gAuth2)" opacity="0.8"/>
                                <defs>
                                    <linearGradient id="gAuth2" x1="2" y1="2" x2="26" y2="26">
                                        <stop stopColor="#818cf8"/>
                                        <stop offset="1" stopColor="#a78bfa"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h1 className="auth-brand-title">InterviewAI</h1>
                        <p className="auth-brand-desc">
                            Join thousands of candidates who ace their interviews with AI-powered practice and real-time feedback.
                        </p>
                        <div className="auth-brand-features">
                            <div className="auth-feature-item">
                                <CheckCircle2 size={18} color="#818cf8" />
                                <span>Unlimited mock interviews</span>
                            </div>
                            <div className="auth-feature-item">
                                <CheckCircle2 size={18} color="#818cf8" />
                                <span>AI-powered resume analysis</span>
                            </div>
                            <div className="auth-feature-item">
                                <CheckCircle2 size={18} color="#818cf8" />
                                <span>RAG Job Description grounding</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel — form */}
                <div className="auth-form-panel">
                    <div className="auth-form-inner">
                        <div className="auth-form-header">
                            <h2>Create Account</h2>
                            <p>Start your interview prep journey today</p>
                        </div>

                        <form onSubmit={handleSignup} className="auth-form">
                            {/* Full Name */}
                            <div className="auth-field">
                                <label htmlFor="signup-fullname">Full Name</label>
                                <div className="auth-input-wrap">
                                    <User size={18} className="input-icon" />
                                    <input
                                        id="signup-fullname"
                                        type="text"
                                        required
                                        autoComplete="name"
                                        placeholder="e.g. Vikas Kumar"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="auth-field">
                                <label htmlFor="signup-email">Email Address</label>
                                <div className="auth-input-wrap">
                                    <Mail size={18} className="input-icon" />
                                    <input
                                        id="signup-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        placeholder="e.g. vikas@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="auth-field">
                                <label htmlFor="signup-password">Password</label>
                                <div className="auth-input-wrap">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        id="signup-password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Create a strong password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ paddingRight: '42px' }}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>

                                {/* Password requirements */}
                                <div className="password-requirements">
                                    <div className={`req-item ${hasMinLength ? 'met' : 'unmet'}`}>
                                        {hasMinLength ? <CheckCircle2 size={13} color="#4ade80" /> : <XCircle size={13} color="rgba(255,255,255,0.3)" />}
                                        <span>Minimum 8 characters</span>
                                    </div>
                                    <div className={`req-item ${hasNumber ? 'met' : 'unmet'}`}>
                                        {hasNumber ? <CheckCircle2 size={13} color="#4ade80" /> : <XCircle size={13} color="rgba(255,255,255,0.3)" />}
                                        <span>At least one number</span>
                                    </div>
                                    <div className={`req-item ${hasUppercase ? 'met' : 'unmet'}`}>
                                        {hasUppercase ? <CheckCircle2 size={13} color="#4ade80" /> : <XCircle size={13} color="rgba(255,255,255,0.3)" />}
                                        <span>At least one uppercase letter</span>
                                    </div>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="auth-field">
                                <label htmlFor="signup-confirm-password">Confirm Password</label>
                                <div className="auth-input-wrap">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        id="signup-confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Re-enter your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        style={{ paddingRight: '42px' }}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        tabIndex={-1}
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    >
                                        {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>

                                {confirmPassword && (
                                    <div className={`password-match-hint ${passwordsMatch ? 'matched' : 'mismatched'}`}>
                                        {passwordsMatch ? (
                                            <>
                                                <CheckCircle2 size={13} color="#4ade80" />
                                                <span>Passwords match</span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={13} color="#f87171" />
                                                <span>Passwords do not match</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Terms & Conditions */}
                            <label className="terms-checkbox-wrap">
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    required
                                />
                                <span>
                                    I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms & Conditions</a> and <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                                </span>
                            </label>

                            {/* Submit button */}
                            <button
                                type="submit"
                                className="auth-submit"
                                disabled={loading || !agreedToTerms || (confirmPassword.length > 0 && !passwordsMatch)}
                            >
                                {loading ? (
                                    <span className="auth-spinner"></span>
                                ) : (
                                    <>
                                        Create Account
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M5 12h14M12 5l7 7-7 7"/>
                                        </svg>
                                    </>
                                )}
                            </button>

                            {message && <p className="auth-error">{message}</p>}
                        </form>

                        <div className="auth-footer-link">
                            Already have an account? <Link to="/signin">Sign In</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
