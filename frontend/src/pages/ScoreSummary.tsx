import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
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
import '../styles/checkscore.css';
import logo from '../assets/logo1.png';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ScoreSummary: React.FC = () => {
    const [scores, setScores] = useState<number[]>([]);
    const [suggestion, setSuggestion] = useState('Loading progress...');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchScores = async () => {
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/');

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
            label: 'Score History',
            data: scores,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    return (
        <div className="progress-tracker">
            <img src={logo} alt="Logo" className="logo" />
            <div className="chart-container">
                <Line data={chartData} />
                <p>{suggestion}</p>
            </div>
            <button onClick={() => navigate('/dashboard')}>Home</button>
            <button onClick={() => navigate('/interview')}>Start Interview</button>
        </div>
    );
};

export default ScoreSummary;
