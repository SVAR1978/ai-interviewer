import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/getscore.css';

const ScoreDetail: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDetail = async () => {
            const user = localStorage.getItem('username');
            if (!user) return navigate('/');

            try {
                const res = await fetch('http://localhost:3000/api/score', {
                    method: 'POST',
                    headers: { 'username': user }
                });
                const jsonData = await res.json();
                setData(jsonData);
            } catch {
                alert('Failed to get score');
            }
        };
        fetchDetail();
    }, [navigate]);

    if (!data) return <div className="loading">Generating Feedback...</div>;

    return (
        <div className="container">
            <div className="header">
                <div>
                    <div className="title">Feedback on the Interview</div>
                    <div className="timestamp">{new Date().toLocaleDateString()}</div>
                </div>
                <div>
                    <div className="score">Score: {data.overall_score || '--'}/10</div>
                    <div className="button-group">
                        <button onClick={() => navigate('/dashboard')}>Home</button>
                        <button onClick={() => navigate('/interview')}>Another Interview</button>
                    </div>
                </div>
            </div>

            <div className="section">
                <p>{data.overall_feedback}</p>
            </div>

            <div className="section">
                <h2>Strengths</h2>
                <p>{data.strengths}</p>
            </div>

            <div className="section">
                <h2>Areas for Improvement</h2>
                <ul>
                    {data.improvement_points?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
            </div>
        </div>
    );
};

export default ScoreDetail;
