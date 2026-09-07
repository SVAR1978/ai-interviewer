import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import '../styles/dashboard-theme.css';

const DashboardLayout: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();
    const [displayName] = useState(() => {
        const fn = localStorage.getItem('fullName');
        const un = localStorage.getItem('username');
        return fn || (un ? un.replace(/_\d{4,}$/, '') : 'User');
    });

    const handleLogout = () => {
        localStorage.removeItem('jwttoken');
        localStorage.removeItem('username');
        localStorage.removeItem('fullName');
        navigate('/signin');
    };

    return (
        <div className="dashboard-layout">
            {/* Animated Background */}
            <div className="dash-bg-orbs">
                <div className="dash-orb dash-orb-1"></div>
                <div className="dash-orb dash-orb-2"></div>
                <div className="dash-grid"></div>
            </div>

            {/* Navigation Bar */}
            <nav className="dash-nav">
                <NavLink to="/dashboard" className="dash-logo">
                    <div className="dash-logo-icon">
                        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                            <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#gDashLayout)" strokeWidth="2" fill="none"/>
                            <circle cx="14" cy="14" r="5" fill="url(#gDashLayout)" opacity="0.8"/>
                            <defs>
                                <linearGradient id="gDashLayout" x1="2" y1="2" x2="26" y2="26">
                                    <stop stopColor="#818cf8"/>
                                    <stop offset="1" stopColor="#a78bfa"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <span className="dash-logo-text">InterviewAI</span>
                </NavLink>

                <button 
                    className="dash-menu-btn" 
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle menu"
                >
                    {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                <div className={`dash-links ${menuOpen ? 'open' : ''}`}>
                    <NavLink to="/dashboard" className={({isActive}) => isActive ? "dash-link active" : "dash-link"}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/interview" className={({isActive}) => isActive ? "dash-link active" : "dash-link"}>
                        Mock Interview
                    </NavLink>
                    <NavLink to="/resume" className={({isActive}) => isActive ? "dash-link active" : "dash-link"}>
                        Resume Check
                    </NavLink>
                    <NavLink to="/job-descriptions" className={({isActive}) => isActive ? "dash-link active" : "dash-link"}>
                        Job Descriptions
                    </NavLink>
                    <NavLink to="/scores" className={({isActive}) => isActive ? "dash-link active" : "dash-link"}>
                        Progress
                    </NavLink>

                    <div className="dash-user">
                        <span className="dash-welcome">Hi, <span>{displayName}</span></span>
                        <button onClick={handleLogout} className="dash-logout">
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* Page Content */}
            <main className="dash-content">
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;
