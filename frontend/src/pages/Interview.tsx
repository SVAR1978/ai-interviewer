import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/interviewstart.css';

const Interview: React.FC = () => {
    const [domain, setDomain] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleStart = async () => {
        if (!domain) return alert('Enter domain');
        setIsLoading(true);
        const user = localStorage.getItem('username');
        if (!user) return navigate('/');

        try {
            const res = await fetch('http://localhost:3000/api/interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': user
                },
                body: JSON.stringify({ domain })
            });
            const data = await res.json();
            localStorage.setItem('firstQuestion', data.question);
            localStorage.setItem('domain', domain);
            navigate('/interview/session');
        } catch (err) {
            alert('Failed to start interview');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="interview-section">
            <div className="interview-box">
                <h2>Choose Your Interview Domain</h2>
                <div className="input-box">
                    <input 
                        type="text" 
                        value={domain} 
                        onChange={(e) => setDomain(e.target.value)} 
                        placeholder="e.g. Frontend Developer, Data Scientist"
                        required 
                    />
                </div>
                <button onClick={handleStart} disabled={isLoading}>
                    {isLoading ? 'Wait...' : 'Generate Questions'}
                </button>
            </div>
        </section>
    );
};

export default Interview;
