import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import '../styles/landing.css';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="landing">
            {/* Animated background elements */}
            <div className="landing-bg">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
                <div className="grid-overlay"></div>
            </div>

            {/* Navigation */}
            <nav className={`landing-nav ${scrollY > 50 ? 'nav-scrolled' : ''}`}>
                <div className="nav-inner">
                    <div className="nav-brand">
                        <div className="brand-icon">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#grad1)" strokeWidth="2" fill="none"/>
                                <circle cx="14" cy="14" r="5" fill="url(#grad1)" opacity="0.8"/>
                                <defs>
                                    <linearGradient id="grad1" x1="2" y1="2" x2="26" y2="26">
                                        <stop stopColor="#818cf8"/>
                                        <stop offset="1" stopColor="#a78bfa"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="brand-text">InterviewAI</span>
                    </div>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#testimonials">Reviews</a>
                    </div>
                    <div className="nav-actions">
                        <button className="btn-ghost" onClick={() => navigate('/signin')}>Sign In</button>
                        <button className="btn-primary" onClick={() => navigate('/signup')}>Get Started Free</button>
                    </div>
                    {/* Mobile menu button */}
                    <button className="mobile-menu-btn" onClick={(e) => {
                        const nav = e.currentTarget.closest('.landing-nav');
                        nav?.classList.toggle('nav-open');
                    }}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
                {/* Mobile dropdown */}
                <div className="mobile-nav-dropdown">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How It Works</a>
                    <a href="#testimonials">Reviews</a>
                    <button className="btn-ghost" onClick={() => navigate('/signin')}>Sign In</button>
                    <button className="btn-primary" onClick={() => navigate('/signup')}>Get Started Free</button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="badge-dot"></span>
                        <span>AI-Powered Interview Preparation</span>
                    </div>
                    <h1 className="hero-title">
                        Ace Your Next
                        <br />
                        <span className="gradient-text">Interview</span> with AI
                    </h1>
                    <p className="hero-subtitle">
                        Practice with our intelligent AI interviewer, get real-time feedback on your answers,
                        and build the confidence to land your dream job.
                    </p>
                    <div className="hero-cta">
                        <button className="btn-primary btn-lg" onClick={() => navigate('/signup')}>
                            Start Practicing Now
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </button>
                        <button className="btn-outline btn-lg" onClick={() => {
                            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                            See How It Works
                        </button>
                    </div>
                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-number">10K+</span>
                            <span className="stat-label">Mock Interviews</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat">
                            <span className="stat-number">95%</span>
                            <span className="stat-label">Success Rate</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat">
                            <span className="stat-number" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                4.9 <Star size={18} fill="#f59e0b" color="#f59e0b" />
                            </span>
                            <span className="stat-label">User Rating</span>
                        </div>
                    </div>
                </div>
                <div className="hero-visual">
                    {/* 3D Glassmorphism card stack */}
                    <div className="hero-3d-scene">
                        <div className="floating-card card-back">
                            <div className="card-header-bar"></div>
                            <div className="card-line"></div>
                            <div className="card-line short"></div>
                        </div>
                        <div className="floating-card card-mid">
                            <div className="card-header-bar"></div>
                            <div className="card-line"></div>
                            <div className="card-line short"></div>
                            <div className="card-line"></div>
                        </div>
                        <div className="floating-card card-front">
                            <div className="card-icon-row">
                                <div className="card-avatar">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(129,140,248,0.8)" strokeWidth="2">
                                        <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z"/>
                                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                                    </svg>
                                </div>
                                <span className="card-label">Mock Interview</span>
                                <span className="card-badge-live">● Live</span>
                            </div>
                            <div className="card-question">
                                "Tell me about a challenging project you've worked on..."
                            </div>
                            <div className="card-waveform">
                                {[...Array(24)].map((_, i) => (
                                    <div key={i} className="wave-bar" style={{ '--delay': `${i * 0.05}s`, '--h': `${15 + Math.sin(i * 0.7) * 12}px` } as React.CSSProperties}></div>
                                ))}
                            </div>
                            <div className="card-score-row">
                                <div className="mini-score">
                                    <div className="score-fill" style={{ width: '87%' }}></div>
                                </div>
                                <span className="score-text">87% Confidence</span>
                            </div>
                        </div>
                        {/* Decorative particles */}
                        <div className="hero-particles">
                            {[...Array(6)].map((_, i) => (
                                <span key={i} className="h-particle" style={{ '--pi': i } as React.CSSProperties}></span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section" id="features">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-tag">Features</span>
                        <h2 className="section-title">Everything You Need to <span className="gradient-text">Succeed</span></h2>
                        <p className="section-desc">Powerful tools designed to transform your interview performance</p>
                    </div>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2a3 3 0 00-3 3v4a3 3 0 006 0V5a3 3 0 00-3-3z"/>
                                    <path d="M19 10v1a7 7 0 01-14 0v-1"/>
                                    <line x1="12" y1="18" x2="12" y2="22"/>
                                    <line x1="8" y1="22" x2="16" y2="22"/>
                                </svg>
                            </div>
                            <h3>AI Mock Interviews</h3>
                            <p>Realistic interview simulations powered by advanced AI. Practice behavioral, technical, and case interviews.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                    <path d="M14 2v6h6"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                    <line x1="10" y1="9" x2="8" y2="9"/>
                                </svg>
                            </div>
                            <h3>Resume Analysis</h3>
                            <p>Get AI-powered insights on your resume. Identify strengths, fix weaknesses, and optimize for ATS systems.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                </svg>
                            </div>
                            <h3>Performance Tracking</h3>
                            <p>Detailed scoring and analytics for every session. Track your improvement over time with visual charts.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                </svg>
                            </div>
                            <h3>Job-Specific Prep</h3>
                            <p>Paste any job description and get tailored interview questions. Prepare for the exact role you're targeting.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                </svg>
                            </div>
                            <h3>Real-Time Feedback</h3>
                            <p>Instant AI feedback on answer quality, communication clarity, and areas for improvement after each response.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                            </div>
                            <h3>Confidence Builder</h3>
                            <p>Reduce interview anxiety through repeated practice in a safe, judgment-free AI environment.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="how-section" id="how-it-works">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-tag">Process</span>
                        <h2 className="section-title">How It <span className="gradient-text">Works</span></h2>
                        <p className="section-desc">Get started in minutes — no setup required</p>
                    </div>
                    <div className="steps-row">
                        <div className="step-card">
                            <div className="step-number">01</div>
                            <h3>Create Account</h3>
                            <p>Sign up in seconds. No credit card needed to start practicing.</p>
                        </div>
                        <div className="step-connector">
                            <svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="rgba(129,140,248,0.3)" strokeWidth="2" strokeDasharray="4 4"/></svg>
                        </div>
                        <div className="step-card">
                            <div className="step-number">02</div>
                            <h3>Choose Your Path</h3>
                            <p>Select a job description or start a general mock interview session.</p>
                        </div>
                        <div className="step-connector">
                            <svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="rgba(129,140,248,0.3)" strokeWidth="2" strokeDasharray="4 4"/></svg>
                        </div>
                        <div className="step-card">
                            <div className="step-number">03</div>
                            <h3>Practice & Improve</h3>
                            <p>Answer AI-generated questions and receive instant, actionable feedback.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="testimonials-section" id="testimonials">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-tag">Testimonials</span>
                        <h2 className="section-title">Loved by <span className="gradient-text">Thousands</span></h2>
                        <p className="section-desc">See what our users say about their experience</p>
                    </div>
                    <div className="testimonials-grid">
                        <div className="testimonial-card">
                            <div className="stars" style={{ display: 'flex', gap: '3px' }}>
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={15} fill="#f59e0b" color="#f59e0b" />
                                ))}
                            </div>
                            <p>"This tool helped me prepare for my Google interview. The AI feedback was incredibly detailed and accurate."</p>
                            <div className="testimonial-author">
                                <div className="author-avatar av-1">R</div>
                                <div>
                                    <strong>Rahul Sharma</strong>
                                    <span>Software Engineer</span>
                                </div>
                            </div>
                        </div>
                        <div className="testimonial-card">
                            <div className="stars" style={{ display: 'flex', gap: '3px' }}>
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={15} fill="#f59e0b" color="#f59e0b" />
                                ))}
                            </div>
                            <p>"I went from being terrified of interviews to feeling confident. The mock sessions are so realistic!"</p>
                            <div className="testimonial-author">
                                <div className="author-avatar av-2">P</div>
                                <div>
                                    <strong>Priya Patel</strong>
                                    <span>Product Manager</span>
                                </div>
                            </div>
                        </div>
                        <div className="testimonial-card">
                            <div className="stars" style={{ display: 'flex', gap: '3px' }}>
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={15} fill="#f59e0b" color="#f59e0b" />
                                ))}
                            </div>
                            <p>"The resume analysis feature alone is worth it. It caught things I'd never noticed in my CV."</p>
                            <div className="testimonial-author">
                                <div className="author-avatar av-3">A</div>
                                <div>
                                    <strong>Amit Kumar</strong>
                                    <span>Data Scientist</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-glow"></div>
                <div className="section-container cta-inner">
                    <h2>Ready to Land Your Dream Job?</h2>
                    <p>Join thousands of candidates who prepared smarter with AI.</p>
                    <button className="btn-primary btn-lg" onClick={() => navigate('/signup')}>
                        Get Started — It's Free
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="section-container footer-inner">
                    <div className="footer-brand">
                        <div className="brand-icon">
                            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                                <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#grad2)" strokeWidth="2" fill="none"/>
                                <circle cx="14" cy="14" r="5" fill="url(#grad2)" opacity="0.8"/>
                                <defs>
                                    <linearGradient id="grad2" x1="2" y1="2" x2="26" y2="26">
                                        <stop stopColor="#818cf8"/>
                                        <stop offset="1" stopColor="#a78bfa"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span>InterviewAI</span>
                    </div>
                    <p className="footer-copy">
                        © 2026 InterviewAI. Built with <Heart size={14} fill="#ef4444" color="#ef4444" style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 3px' }} /> for job seekers everywhere.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
