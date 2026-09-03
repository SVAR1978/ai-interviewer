import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Lightbulb, Sparkles } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ScoreSummary: React.FC = () => {
    const [scores, setScores] = useState<number[]>([]);
    const [suggestion, setSuggestion] = useState('Loading progress...');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchScores = async () => {
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            try {
                const res = await fetch('http://localhost:3000/api/checkscore', {
                    method: 'POST',
                    headers: { 'jwttoken': token }
                });
                const data = await res.json();
                setScores(data.array || []);
                setSuggestion(data.suggestion);
            } catch {
                setSuggestion('Failed to load scores.');
            }
        };
        fetchScores();
    }, [navigate]);

    const chartData = {
        labels: scores.map((_, i) => `Test ${i + 1}`),
        datasets: [{
            label: 'Score History (out of 10)',
            data: scores,
            borderColor: '#818cf8',
            backgroundColor: 'rgba(129, 140, 248, 0.2)',
            borderWidth: 3,
            tension: 0.3,
            pointBackgroundColor: '#a5b4fc',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 10,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.6)'
                }
            },
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.6)'
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: 'rgba(255, 255, 255, 0.8)',
                    font: {
                        family: "'Poppins', sans-serif"
                    }
                }
            }
        }
    };

    return (
        <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="glass-panel" style={{ maxWidth: '800px', width: '100%' }}>
                <div className="glass-header">
                    <h2>Progress Tracker</h2>
                    <p>Monitor your mock interview performance over time</p>
                </div>

                <div style={{
                    height: '400px',
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '24px'
                }}>
                    <Line data={chartData} options={chartOptions} />
                </div>

                <div style={{
                    padding: '20px',
                    background: 'rgba(99, 102, 241, 0.05)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    marginBottom: '32px'
                }}>
                    <h3 style={{ color: '#a5b4fc', fontSize: '16px', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Lightbulb size={18} color="#a5b4fc" />
                        AI Suggestion
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.6' }}>
                        {suggestion}
                    </p>
                </div>

                <button 
                    className="btn-primary" 
                    onClick={() => navigate('/interview')}
                    style={{ maxWidth: '300px', margin: '0 auto' }}
                >
                    <Sparkles size={16} />
                    Start Next Interview
                </button>
            </div>
        </div>
    );
};

export default ScoreSummary;
