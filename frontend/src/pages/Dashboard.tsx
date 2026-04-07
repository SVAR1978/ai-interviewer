import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/aifrontend.css';
import logo from '../assets/logo1.png';

const Dashboard: React.FC = () => {
    const [username, setUsername] = useState('');
    const [userImage, setUserImage] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('username');
        if (!storedUser) {
            navigate('/');
            return;
        }
        setUsername(storedUser);
        fetchImage(storedUser);
    }, [navigate]);

    const fetchImage = async (user: string) => {
        try {
            const res = await fetch('http://localhost:3000/api/getimage', {
                method: 'POST',
                headers: { 'username': user }
            });
            const data = await res.json();
            if (data.image) setUserImage(data.image);
        } catch {}
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    return (
        <div className="home-container">
            <header className="header">
                <nav className="navbar">
                    <img src={logo} alt="Logo" className="logo" />
                    <ul>
                        <li><Link to="/resume">Check Resume</Link></li>
                        <li><Link to="/scores">Check Last Scores</Link></li>
                        <li onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</li>
                    </ul>
                    <div className="profile">
                        <span id="pname">{username}</span>
                        <div id="pimage">
                            {userImage ? <img src={userImage} alt="Profile" /> : <div className="placeholder-user"></div>}
                        </div>
                    </div>
                </nav>
            </header>

            <main className="content">
                <iframe 
                    src="https://my.spline.design/nexbotrobotcharacterconcept-d536e6c996f8bd426a856c25e074ba70/" 
                    allowFullScreen 
                    className="spline-robot"
                ></iframe>
                <div className="ai-message">
                    <h1>Welcome, {username}</h1>
                    <p>Get Interview-Ready with AI-Powered Practice & Feedback</p>
                    <button onClick={() => navigate('/interview')}>Start Mock Interview</button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
