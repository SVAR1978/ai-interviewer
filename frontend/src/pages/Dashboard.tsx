import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/aifrontend.css';
import '../styles/dashboard-theme.css';

const Dashboard: React.FC = () => {
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('username');
        if (!storedUser) {
            navigate('/signin');
            return;
        }
        setUsername(storedUser);
    }, [navigate]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '70vh',
            gap: '40px',
            flexWrap: 'wrap',
        }}>
            {/* Left — AI Message */}
            <div style={{
                flex: '1 1 400px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                minHeight: '400px',
            }}>
                <h1 style={{
                    fontSize: 'clamp(32px, 5vw, 48px)',
                    fontWeight: '700',
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, #fff, #a5b4fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: '1.2',
                }}>
                    Welcome, {username}
                </h1>
                <p style={{
                    fontSize: '18px',
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '36px',
                    maxWidth: '460px',
                    lineHeight: '1.6',
                }}>
                    Get Interview-Ready with AI-Powered Practice & Real-Time Feedback
                </p>
                <button
                    className="btn-primary"
                    onClick={() => navigate('/interview')}
                    style={{ maxWidth: '260px' }}
                >
                    Start Mock Interview
                </button>
            </div>

            {/* Right — 3D Orb */}
            <div style={{
                flex: '1 1 350px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <div className="orb-scene">
                    <div className="orb-glow"></div>
                    <div className="orb-ring orb-ring-1"></div>
                    <div className="orb-ring orb-ring-2"></div>
                    <div className="orb-ring orb-ring-3"></div>
                    <div className="orb-core">
                        <div className="orb-inner"></div>
                        <div className="orb-shine"></div>
                    </div>
                    <div className="orb-particles">
                        {[...Array(12)].map((_, i) => (
                            <span key={i} className="particle" style={{ '--i': i } as React.CSSProperties}></span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
