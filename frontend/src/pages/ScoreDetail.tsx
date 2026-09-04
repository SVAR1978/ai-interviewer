import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoaderOverlay from '../components/LoaderOverlay';

const ScoreDetail: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const fetchDetail = async () => {
        const user = localStorage.getItem('username');
        if (!user) return navigate('/signin');

        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'username': user }
            });
            const jsonData = await res.json();

            if (!res.ok) {
                setError(jsonData.error || 'Failed to generate score. Please try again.');
                return;
            }

            console.log('Score response:', jsonData);
            setData(jsonData);
        } catch {
            setError('Failed to connect to the server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [navigate]);

    // Helper to render strengths (handles both string and array)
    const renderStrengths = (strengths: any) => {
        if (!strengths) return <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontStyle: 'italic' }}>No strengths data available.</p>;
        if (Array.isArray(strengths)) {
            return (
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', fontSize: '14px' }}>
                    {strengths.map((s: string, i: number) => (
                        <li key={i} style={{ marginBottom: '8px' }}>{s}</li>
                    ))}
                </ul>
            );
        }
        return <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.6', fontSize: '14px' }}>{String(strengths)}</p>;
    };

    // Helper to render improvement points (handles both string and array)
    const renderImprovements = (points: any) => {
        if (!points) return <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontStyle: 'italic' }}>No improvement areas identified.</p>;
        if (Array.isArray(points)) {
            return (
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', fontSize: '14px' }}>
                    {points.map((p: string, i: number) => (
                        <li key={i} style={{ marginBottom: '8px' }}>{String(p)}</li>
                    ))}
                </ul>
            );
        }
        return <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.6', fontSize: '14px' }}>{String(points)}</p>;
    };

    // Get score color based on value
    const getScoreColor = (score: string) => {
        const num = parseInt(score) || 0;
        if (num >= 8) return '#4ade80';
        if (num >= 6) return '#facc15';
        if (num >= 4) return '#fb923c';
        return '#f87171';
    };

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
                    <h2 style={{ color: '#f87171', margin: '0 0 16px' }}>Score Generation Failed</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 24px', lineHeight: '1.6' }}>
                        {error}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={() => navigate('/interview')}>
                            New Interview
                        </button>
                        <button className="btn-primary" onClick={fetchDetail} disabled={isLoading} style={{ width: 'auto', padding: '12px 24px' }}>
                            {isLoading ? 'Retrying...' : 'Retry'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading || !data) {
        return (
            <LoaderOverlay 
                isVisible={true} 
                text="Analyzing Interview Performance..." 
                subText="The AI is evaluating your responses and generating detailed feedback. This may take a moment." 
            />
        );
    }

    const scoreValue = data.overall_score?.match?.(/\d+/)?.[0] || data.overall_score || '--';

    return (
        <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ maxWidth: '800px', width: '100%' }}>
                
                {/* Header Section */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '24px',
                    marginBottom: '32px',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div>
                        <h2 style={{ 
                            fontSize: '28px', 
                            fontWeight: '700', 
                            margin: '0 0 8px',
                            background: 'linear-gradient(135deg, #fff, #a5b4fc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Interview Feedback
                        </h2>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                            fontSize: '12px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '1px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px'
                        }}>
                            Overall Score
                        </div>
                        <div style={{ 
                            fontSize: '36px', 
                            fontWeight: '800', 
                            color: getScoreColor(scoreValue)
                        }}>
                            {scoreValue}<span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.3)' }}>/10</span>
                        </div>
                    </div>
                </div>

                {/* Overall Feedback */}
                {data.overall_feedback && (
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{ color: '#e2e8f0', fontSize: '18px', marginBottom: '12px' }}>Overall Assessment</h3>
                        <div style={{ 
                            background: 'rgba(255,255,255,0.03)', 
                            padding: '20px', 
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.8)',
                            lineHeight: '1.7',
                            fontSize: '15px'
                        }}>
                            {data.overall_feedback}
                        </div>
                    </div>
                )}

                {/* Strengths & Improvements Grid */}
                <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
                    {/* Strengths */}
                    <div style={{ 
                        background: 'rgba(74,222,128,0.05)', 
                        border: '1px solid rgba(74,222,128,0.15)',
                        borderRadius: '16px',
                        padding: '24px'
                    }}>
                        <h3 style={{ color: '#4ade80', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            Key Strengths
                        </h3>
                        {renderStrengths(data.strengths)}
                    </div>

                    {/* Areas for Improvement */}
                    <div style={{ 
                        background: 'rgba(248,113,113,0.05)', 
                        border: '1px solid rgba(248,113,113,0.15)',
                        borderRadius: '16px',
                        padding: '24px'
                    }}>
                        <h3 style={{ color: '#f87171', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            Areas for Improvement
                        </h3>
                        {renderImprovements(data.improvement_points)}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" onClick={() => navigate('/scores')} style={{ minWidth: '150px' }}>
                        Score History
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/interview')} style={{ minWidth: '200px' }}>
                        Start Another Interview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScoreDetail;
