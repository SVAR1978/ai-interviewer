import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
    Lightbulb,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    Code2,
    Brain,
    Eye,
    Calendar,
    ArrowUpRight,
    Award,
    Activity,
    SlidersHorizontal,
    Clock
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export interface ISubScores {
    technical: number;
    communication: number;
    problemSolving: number;
    presence: number;
    overall: number;
}

export interface ISessionRecord {
    sessionId: string;
    timestamp: string;
    overallScore: number;
    subScores: ISubScores;
    metrics?: {
        eyeContactPercentage?: number;
        postureStabilityPercentage?: number;
        engagementPercentage?: number;
        technicalDepth?: string;
        readinessVerdict?: string;
    };
    feedbackSummary?: string;
}

export interface IDomainAverages {
    technical: number;
    problemSolving: number;
    communication: number;
    presence: number;
    overall: number;
}

export interface ITrajectoryItem {
    delta: number;
    signedDelta: number;
    direction: 'up' | 'down' | 'neutral';
}

type DomainFilter = 'all' | 'technical' | 'communication' | 'overall';
type TimeframeFilter = '5' | '10' | 'all';

const ScoreSummary: React.FC = () => {
    const [sessions, setSessions] = useState<ISessionRecord[]>([]);
    const [domainAverages, setDomainAverages] = useState<IDomainAverages>({
        technical: 0,
        problemSolving: 0,
        communication: 0,
        presence: 0,
        overall: 0,
    });
    const [trajectory, setTrajectory] = useState<Record<string, ITrajectoryItem>>({});
    const [suggestion, setSuggestion] = useState<string>('Analyzing your interview trajectory...');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
    const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchScores = async () => {
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            try {
                setIsLoading(true);
                const res = await fetch('http://localhost:3000/api/checkscore', {
                    method: 'POST',
                    headers: { 'jwttoken': token }
                });
                const data = await res.json();

                if (Array.isArray(data.sessions) && data.sessions.length > 0) {
                    setSessions(data.sessions);
                    if (data.domainAverages) setDomainAverages(data.domainAverages);
                    if (data.trajectory) setTrajectory(data.trajectory);
                } else if (Array.isArray(data.array) && data.array.length > 0) {
                    // Fallback for raw numeric array
                    const synthSessions: ISessionRecord[] = data.array.map((num: number, idx: number) => ({
                        sessionId: `legacy_${idx + 1}`,
                        timestamp: new Date(Date.now() - (data.array.length - 1 - idx) * 86400000).toISOString(),
                        overallScore: num,
                        subScores: {
                            technical: num,
                            problemSolving: num,
                            communication: num,
                            presence: num,
                            overall: num
                        },
                        metrics: {
                            technicalDepth: 'Proficient',
                            readinessVerdict: num >= 8 ? 'Strong Hire' : 'Candidate Evaluation Complete'
                        }
                    }));
                    setSessions(synthSessions);
                    const avg = Math.round((data.array.reduce((a: number, b: number) => a + b, 0) / data.array.length) * 10) / 10;
                    setDomainAverages({ technical: avg, problemSolving: avg, communication: avg, presence: avg, overall: avg });
                }

                setSuggestion(data.suggestion || 'Complete mock interviews to track your domain performance.');
            } catch {
                setSuggestion('Failed to load telemetry analytics.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchScores();
    }, [navigate]);

    // Filter sessions by timeframe
    const displayedSessions = useMemo(() => {
        if (!sessions || sessions.length === 0) return [];
        if (timeframe === '5') return sessions.slice(-5);
        if (timeframe === '10') return sessions.slice(-10);
        return sessions;
    }, [sessions, timeframe]);

    // Format date labels
    const labels = useMemo(() => {
        return displayedSessions.map((s, idx) => {
            const d = new Date(s.timestamp);
            if (isNaN(d.getTime())) return `Test ${idx + 1}`;
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });
    }, [displayedSessions]);

    // Construct Multi-Axis Datasets
    const chartData = useMemo(() => {
        const datasets: any[] = [];

        // Overall Composite Score (Emerald)
        if (domainFilter === 'all' || domainFilter === 'overall') {
            datasets.push({
                label: 'Overall Composite',
                data: displayedSessions.map(s => s.overallScore),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 3.5,
                fill: domainFilter === 'overall',
                tension: 0.35,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                yAxisID: 'y'
            });
        }

        // Technical Accuracy (Indigo)
        if (domainFilter === 'all' || domainFilter === 'technical') {
            datasets.push({
                label: 'Technical Accuracy',
                data: displayedSessions.map(s => s.subScores?.technical ?? s.overallScore),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 2.5,
                tension: 0.35,
                pointBackgroundColor: '#818cf8',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                yAxisID: 'y'
            });
        }

        // Problem Solving & Architecture (Cyan)
        if (domainFilter === 'all' || domainFilter === 'technical') {
            datasets.push({
                label: 'Problem Solving & Design',
                data: displayedSessions.map(s => s.subScores?.problemSolving ?? s.overallScore),
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                borderWidth: 2.5,
                tension: 0.35,
                pointBackgroundColor: '#22d3ee',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                yAxisID: 'y'
            });
        }

        // Verbal & Delivery Communication (Purple)
        if (domainFilter === 'all' || domainFilter === 'communication') {
            datasets.push({
                label: 'Communication & Articulation',
                data: displayedSessions.map(s => s.subScores?.communication ?? s.overallScore),
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                borderWidth: 2.5,
                tension: 0.35,
                pointBackgroundColor: '#c084fc',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                yAxisID: 'y'
            });
        }

        // Multi-Axis: Non-Verbal Presence on Secondary Y-Axis (Amber dashed line)
        if (domainFilter === 'all' || domainFilter === 'communication') {
            datasets.push({
                label: 'Executive Presence (Gaze & Composure %)',
                data: displayedSessions.map(s => {
                    const presence = s.metrics?.eyeContactPercentage 
                        ?? (s.subScores?.presence ? s.subScores.presence * 10 : 80);
                    return presence;
                }),
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [6, 6],
                tension: 0.3,
                pointBackgroundColor: '#fbbf24',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                yAxisID: 'y1'
            });
        }

        return {
            labels,
            datasets
        };
    }, [displayedSessions, labels, domainFilter]);

    // Multi-Axis Chart Options
    const chartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    color: 'rgba(255, 255, 255, 0.85)',
                    boxWidth: 14,
                    boxHeight: 14,
                    padding: 18,
                    font: {
                        family: "'Poppins', sans-serif",
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleColor: '#fff',
                bodyColor: 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    afterTitle: (items: any[]) => {
                        const idx = items[0]?.dataIndex;
                        const session = displayedSessions[idx];
                        if (session?.metrics?.readinessVerdict) {
                            return `Status: ${session.metrics.readinessVerdict}`;
                        }
                        return '';
                    },
                    label: (context: any) => {
                        const label = context.dataset.label || '';
                        const val = context.parsed.y;
                        if (context.dataset.yAxisID === 'y1') {
                            return `${label}: ${val}%`;
                        }
                        return `${label}: ${val} / 10`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.65)',
                    font: { family: "'Poppins', sans-serif" }
                }
            },
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                min: 0,
                max: 10,
                title: {
                    display: true,
                    text: 'Domain Score (0 - 10)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    font: { size: 11, family: "'Poppins', sans-serif" }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    stepSize: 2,
                    color: 'rgba(255, 255, 255, 0.65)',
                    font: { family: "'Poppins', sans-serif" }
                }
            },
            y1: {
                type: 'linear' as const,
                display: domainFilter === 'all' || domainFilter === 'communication',
                position: 'right' as const,
                min: 0,
                max: 100,
                title: {
                    display: true,
                    text: 'Presence & Gaze (%)',
                    color: '#f59e0b',
                    font: { size: 11, family: "'Poppins', sans-serif" }
                },
                grid: {
                    drawOnChartArea: false, // Prevents overlapping grid lines
                },
                ticks: {
                    stepSize: 25,
                    color: '#fbbf24',
                    font: { family: "'Poppins', sans-serif" },
                    callback: (value: any) => `${value}%`
                }
            }
        }
    };

    // Helper for trajectory badge rendering
    const renderTrajectoryBadge = (traj?: ITrajectoryItem) => {
        if (!traj || traj.delta === 0) {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#94a3b8',
                    background: 'rgba(148, 163, 184, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                }}>
                    <Minus size={12} /> Steady
                </span>
            );
        }

        if (traj.direction === 'up') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#4ade80',
                    background: 'rgba(74, 222, 128, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(74, 222, 128, 0.25)'
                }}>
                    <TrendingUp size={12} /> +{traj.delta} pts
                </span>
            );
        }

        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#f87171',
                background: 'rgba(248, 113, 113, 0.1)',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid rgba(248, 113, 113, 0.25)'
            }}>
                <TrendingDown size={12} /> -{traj.delta} pts
            </span>
        );
    };

    // Latest session convenience pointer
    const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

    return (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '85vh' }}>
            <div style={{ maxWidth: '1100px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Header Title Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#a5b4fc',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                <Activity size={13} /> Time-Series Analytics
                            </span>
                        </div>
                        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
                            Domain Performance & Trajectory
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.65)', margin: '4px 0 0', fontSize: '14px' }}>
                            Granular multi-pillar telemetry tracking conceptual rigor, design execution, and executive presence.
                        </p>
                    </div>

                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/interview')}
                        style={{ padding: '10px 20px', fontSize: '14px' }}
                    >
                        <Sparkles size={16} />
                        Start Mock Interview
                    </button>
                </div>

                {/* Domain KPI Scorecards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '16px'
                }}>
                    {/* KPI 1: Technical Mastery */}
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #6366f1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                                    <Code2 size={18} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Technical Rigor</span>
                            </div>
                            {renderTrajectoryBadge(trajectory.technical)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                                {latestSession?.subScores?.technical ?? domainAverages.technical ?? '--'}
                            </span>
                            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>/ 10</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>All-Time Avg: <strong>{domainAverages.technical}/10</strong></span>
                            <span>{latestSession?.metrics?.technicalDepth || 'Proficient'}</span>
                        </div>
                    </div>

                    {/* KPI 2: Problem Solving */}
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #06b6d4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                                    <Brain size={18} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Problem Solving</span>
                            </div>
                            {renderTrajectoryBadge(trajectory.problemSolving)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                                {latestSession?.subScores?.problemSolving ?? domainAverages.problemSolving ?? '--'}
                            </span>
                            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>/ 10</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                            <span>All-Time Avg: <strong>{domainAverages.problemSolving}/10</strong></span>
                        </div>
                    </div>

                    {/* KPI 3: Communication */}
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #a855f7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                                    <Sparkles size={18} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Communication</span>
                            </div>
                            {renderTrajectoryBadge(trajectory.communication)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                                {latestSession?.subScores?.communication ?? domainAverages.communication ?? '--'}
                            </span>
                            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>/ 10</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                            <span>All-Time Avg: <strong>{domainAverages.communication}/10</strong></span>
                        </div>
                    </div>

                    {/* KPI 4: Executive Presence (MediaPipe) */}
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #f59e0b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                                    <Eye size={18} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Presence & Poise</span>
                            </div>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.1)',
                                padding: '2px 8px',
                                borderRadius: '9999px'
                            }}>
                                Multi-Axis
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                                {latestSession?.metrics?.eyeContactPercentage ?? (domainAverages.presence ? Math.round(domainAverages.presence * 10) : 80)}%
                            </span>
                            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>gaze stability</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                            <span>Posture Stability: <strong>{latestSession?.metrics?.postureStabilityPercentage ?? 85}%</strong></span>
                        </div>
                    </div>
                </div>

                {/* Main Interactive Chart Section */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    {/* Chart Controls Bar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        marginBottom: '20px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        {/* Domain Filter Pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                                <SlidersHorizontal size={14} /> Domain:
                            </span>
                            {[
                                { id: 'all', label: 'All Dimensions' },
                                { id: 'technical', label: 'Technical & Design' },
                                { id: 'communication', label: 'Presence & Delivery' },
                                { id: 'overall', label: 'Composite Score' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setDomainFilter(filter.id as DomainFilter)}
                                    style={{
                                        background: domainFilter === filter.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${domainFilter === filter.id ? 'rgba(129, 140, 248, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        color: domainFilter === filter.id ? '#a5b4fc' : 'rgba(255, 255, 255, 0.7)',
                                        padding: '6px 14px',
                                        borderRadius: '9999px',
                                        fontSize: '12px',
                                        fontWeight: domainFilter === filter.id ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {/* Timeframe Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={14} /> Window:
                            </span>
                            {(['5', '10', 'all'] as TimeframeFilter[]).map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    style={{
                                        background: timeframe === tf ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                                        border: 'none',
                                        color: timeframe === tf ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: timeframe === tf ? 600 : 400,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {tf === 'all' ? 'All' : `Last ${tf}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Multi-Axis Chart Canvas */}
                    <div style={{
                        height: '420px',
                        width: '100%',
                        position: 'relative'
                    }}>
                        {isLoading ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                                Loading domain telemetry...
                            </div>
                        ) : displayedSessions.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
                                <Award size={36} color="#818cf8" style={{ opacity: 0.7 }} />
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>No Interview Sessions Logged Yet</h3>
                                <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '13px', maxWidth: '400px' }}>
                                    Complete your first mock interview to generate telemetry records and track multi-session trajectory lines.
                                </p>
                                <button className="btn-primary" onClick={() => navigate('/interview')} style={{ marginTop: '8px' }}>
                                    Begin First Assessment
                                </button>
                            </div>
                        ) : (
                            <Line data={chartData} options={chartOptions} />
                        )}
                    </div>
                </div>

                {/* AI Executive Coaching Advice Panel */}
                <div style={{
                    padding: '22px 24px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.05))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                }}>
                    <div style={{
                        padding: '10px',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#a5b4fc',
                        flexShrink: 0
                    }}>
                        <Lightbulb size={22} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                                AI Trajectory Insights & Growth Recommendation
                            </h3>
                            <span style={{
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: 'rgba(99, 102, 241, 0.25)',
                                color: '#a5b4fc',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700
                            }}>
                                Live Coach
                            </span>
                        </div>
                        <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                            {suggestion}
                        </p>
                    </div>
                </div>

                {/* Session Breakdown Timeline */}
                {displayedSessions.length > 0 && (
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#818cf8" />
                                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fff' }}>
                                    Chronological Session Telemetry
                                </h3>
                            </div>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                {displayedSessions.length} session{displayedSessions.length !== 1 ? 's' : ''} logged
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {displayedSessions.slice().reverse().map((sess, idx) => {
                                const dateObj = new Date(sess.timestamp);
                                const dateStr = !isNaN(dateObj.getTime())
                                    ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                    : `Session ${displayedSessions.length - idx}`;
                                const timeStr = !isNaN(dateObj.getTime())
                                    ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                    : '';

                                const overallNum = sess.overallScore || sess.subScores?.overall || 0;
                                const isHire = overallNum >= 7.5;

                                return (
                                    <div 
                                        key={sess.sessionId || idx}
                                        style={{
                                            padding: '14px 18px',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '12px',
                                            transition: 'background 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: isHire ? 'rgba(74, 222, 128, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                                color: isHire ? '#4ade80' : '#818cf8',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: '15px'
                                            }}>
                                                {overallNum}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                                                        {dateStr}
                                                    </span>
                                                    {timeStr && (
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                                                            {timeStr}
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                                    {sess.metrics?.readinessVerdict || 'Evaluation Complete'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Domain Pills */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                color: '#a5b4fc'
                                            }}>
                                                Tech: <strong>{sess.subScores?.technical ?? overallNum}</strong>
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: 'rgba(6, 182, 212, 0.1)',
                                                border: '1px solid rgba(6, 182, 212, 0.2)',
                                                color: '#67e8f9'
                                            }}>
                                                Problem: <strong>{sess.subScores?.problemSolving ?? overallNum}</strong>
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: 'rgba(168, 85, 247, 0.1)',
                                                border: '1px solid rgba(168, 85, 247, 0.2)',
                                                color: '#d8b4fe'
                                            }}>
                                                Comm: <strong>{sess.subScores?.communication ?? overallNum}</strong>
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                                color: '#fcd34d'
                                            }}>
                                                Presence: <strong>{sess.metrics?.eyeContactPercentage ?? (sess.subScores?.presence ? sess.subScores.presence * 10 : 80)}%</strong>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Bottom Action Footer */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/interview')}
                        style={{ maxWidth: '320px', width: '100%', padding: '14px 28px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                        <Sparkles size={18} />
                        Launch Next Practice Session
                        <ArrowUpRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScoreSummary;
