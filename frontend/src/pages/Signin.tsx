import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/signin.css';
import logo from '../assets/logo1.png';

const Signin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
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
        }
    };

    return (
        <section className="login-section">
            <div className="login-box">
                <img src={logo} alt="AI Interviewer Logo" className="login-logo" />
                <form onSubmit={handleLogin} style={{ width: '100%', textAlign: 'center' }}>
                    <h2>Login</h2>
                    <div className="input-box">
                        <input 
                            type="text" 
                            required 
                            autoComplete="off"
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                        <label>Username</label>
                    </div>
                    <div className="input-box">
                        <input 
                            type="password" 
                            required 
                            autoComplete="off"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                        />
                        <label>Password</label>
                    </div>
                    <div className="remember-forgot">
                        <label>
                            <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/> 
                            Remember me
                        </label>
                        <a href="#">Forgot password?</a>
                    </div>
                    <button type="submit">Sign In</button>
                    {message && <p className="error-message">{message}</p>}
                    <div className="register-link">
                        <p>Don't have an account? <Link to="/signup">Create Account</Link></p>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default Signin;
