import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import '../styles/auth.css';

const Signin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('http://localhost:3000/auth/signin', {
                method: 'POST',
                headers: { username, password }
            });
            const data = await res.json();
            if (data.mes === 'true') {
                localStorage.setItem('username', username);
                localStorage.setItem('jwttoken', data.jwttoken);
                navigate('/dashboard');
            } else {
                setMessage('Invalid credentials. Please try again.');
            }
        } catch (err) {
            setMessage('Unable to connect to the server.');
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
                            Practice smarter. Interview better. Land your dream job with AI-powered preparation.
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
                        <div className="auth-form-header">
                            <h2>Welcome back</h2>
                            <p>Sign in to continue your interview prep</p>
                        </div>

                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="signin-username">Username</label>
                                <div className="auth-input-wrap">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="input-icon">
                                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                    <input
                                        id="signin-username"
                                        type="text"
                                        required
                                        autoComplete="off"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="signin-password">Password</label>
                                <div className="auth-input-wrap">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="input-icon">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                                    </svg>
                                    <input
                                        id="signin-password"
                                        type="password"
                                        required
                                        autoComplete="off"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="auth-options">
                                <label className="auth-checkbox">
                                    <input type="checkbox" />
                                    <span className="checkmark"></span>
                                    Remember me
                                </label>
                                <a href="#" className="auth-link-subtle">Forgot password?</a>
                            </div>

                            <button type="submit" className="auth-submit" disabled={loading}>
                                {loading ? (
                                    <span className="auth-spinner"></span>
                                ) : (
                                    <>
                                        Sign In
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M5 12h14M12 5l7 7-7 7"/>
                                        </svg>
                                    </>
                                )}
                            </button>

                            {message && <p className="auth-error">{message}</p>}
                        </form>

                        <div className="auth-footer-link">
                            Don't have an account? <Link to="/signup">Create Account</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signin;
