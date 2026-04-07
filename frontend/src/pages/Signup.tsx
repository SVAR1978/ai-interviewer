import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/signup.css';

const Signup: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3000/auth/signup', {
                method: 'POST',
                headers: { username, password }
            });
            const data = await res.json();
            if (data.mes === true) {
                navigate('/');
            } else {
                setMessage('User already exists');
            }
        } catch (err) {
            setMessage('Server Error');
        }
    };

    return (
        <section className="signup-section">
            <div className="login-box">
                <form onSubmit={handleSignup}>
                    <h2>Sign up</h2>
                    <div className="input-box">
                        <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} />
                        <label>Name</label>
                    </div>
                    <div className="input-box">
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        <label>Password</label>
                    </div>
                    <button type="submit">Sign up</button>
                    {message && <p className="error-message">{message}</p>}
                    <div className="register-link">
                        <p>Already have an account? <Link to="/">Login</Link></p>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default Signup;
