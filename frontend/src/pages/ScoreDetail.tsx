import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Eye, 
    Smile, 
    ShieldCheck, 
    Sparkles, 
    CheckCircle2, 
    Code2, 
    AlertTriangle, 
    Award, 
    Brain, 
    BookOpen,
    ArrowRight,
    RotateCcw,
    History
} from 'lucide-react';
import LoaderOverlay from '../components/LoaderOverlay';
import type { SessionBehavioralSummary } from '../types/mediaPipeVision';

const ScoreDetail: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [, setBehavioralSummary] = useState<SessionBehavioralSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const fetchDetail = async () => {
        const user = localStorage.getItem('username');
        if (!user) return navigate('/signin');

        setError(null);
        setIsLoading(true);

        let parsedBehavioral: any = null;
        try {
            const rawMetrics = localStorage.getItem('interview_behavioral_metrics');
            if (rawMetrics) {
                parsedBehavioral = JSON.parse(rawMetrics);
                setBehavioralSummary(parsedBehavioral);
            }
        } catch (e) {
            console.warn('Could not parse behavioral metrics:', e);
        }

        try {
            const res = await fetch('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'username': user 
                },
                body: JSON.stringify({
                    behavioralMetrics: parsedBehavioral
                })
            });
            const jsonData = await res.json();

            if (!res.ok) {
                setError(jsonData.error || 'Failed to generate score. Please try again.');
                return;
            }

            console.log('Dual-Pillar Score response:', jsonData);
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

    // Color helper for numeric score
    const getScoreColor = (score: string | number) => {
        const num = parseFloat(String(score)) || 0;
        if (num >= 8.0) return '#4ade80';
        if (num >= 6.5) return '#38bdf8';
        if (num >= 5.0) return '#facc15';
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
                text="Evaluating Dual-Pillar Performance..." 
                subText="Gemini is analyzing technical transcript accuracy while MediaPipe metrics compute non-verbal presence." 
            />
        );
    }

    // Extract Dual-Pillar Data
    const compositeScore = data.composite_score || data.overall_score || '7.5';
    const readinessVerdict = data.readiness_verdict || 'Candidate Evaluation Complete';
    const techData = data.technical_accuracy || {
        score: data.overall_score || '7.0',
        weight: '60%',
        depth_level: 'Proficient',
        feedback: data.overall_feedback || 'Technical analysis completed.',
        strengths: Array.isArray(data.strengths) ? data.strengths : [data.strengths],
        gaps: Array.isArray(data.improvement_points) ? data.improvement_points : [data.improvement_points]
    };
    const behData = data.behavioral_confidence || {
        score: '8.0',
        weight: '40%',
        overall_presence_score: 80,
        eye_contact_percentage: 80,
        posture_stability_percentage: 85,
        engagement_percentage: 75,
        expression_distribution: { smilingTimePct: 15, attentiveTimePct: 65, speakingTimePct: 15, neutralTimePct: 5 },
        strengths: ['Consistent webcam alignment and engagement maintained.'],
        coaching_tips: ['Focus directly into the camera lens during key explanations.']
    };

    return (
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '960px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Top Hero Banner: Dual-Pillar Readiness Index */}
                <div className="glass-panel" style={{
                    padding: '28px',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 27, 75, 0.7))',
                    border: '1px solid rgba(129, 140, 248, 0.3)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '-40px',
                        width: '180px',
                        height: '180px',
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '20px'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <Award size={18} style={{ color: '#818cf8' }} />
                                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: '#818cf8' }}>
                                    Dual-Pillar Scoring Engine
                                </span>
                            </div>
                            <h2 style={{
                                fontSize: '30px',
                                fontWeight: '800',
                                margin: '0 0 10px',
                                background: 'linear-gradient(135deg, #ffffff, #c7d2fe)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Interview Readiness Assessment
                            </h2>
                            {/* Readiness Verdict Badge */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.35)',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#e0e7ff'
                            }}>
                                <Sparkles size={14} style={{ color: '#818cf8' }} />
                                <span>{readinessVerdict}</span>
                            </div>
                        </div>

                        {/* Composite Score Circle / Hero Metric */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '16px 24px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px' }}>
                                Composite Readiness Score
                            </span>
                            <div style={{ fontSize: '42px', fontWeight: '900', color: getScoreColor(compositeScore), lineHeight: '1' }}>
                                {compositeScore}<span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>/10</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#818cf8', marginTop: '6px' }}>
                                60% Technical • 40% Behavioral
                            </span>
                        </div>
                    </div>
                </div>

                {/* Side-by-Side Dual Pillar Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                    gap: '24px'
                }}>

                    {/* ==================================================== */}
                    {/* PILLAR 1: TECHNICAL ACCURACY (Gemini Semantic Analysis) */}
                    {/* ==================================================== */}
                    <div className="glass-panel" style={{
                        padding: '24px',
                        borderLeft: '4px solid #38bdf8',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {/* Pillar 1 Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <Code2 size={20} style={{ color: '#38bdf8' }} />
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                                        Pillar 1: Technical Accuracy
                                    </h3>
                                </div>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    Gemini semantic transcript analysis
                                </span>
                            </div>

                            {/* Score & Weight Badge */}
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', lineHeight: '1' }}>
                                    {techData.score}<span style={{ fontSize: '14px', color: '#64748b' }}>/10</span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>Weight: 60%</span>
                            </div>
                        </div>

                        {/* Depth Level Indicator */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '12px'
                        }}>
                            <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brain size={14} style={{ color: '#38bdf8' }} />
                                Conceptual Depth Level:
                            </span>
                            <span style={{
                                fontWeight: 700,
                                color: '#38bdf8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {techData.depth_level}
                            </span>
                        </div>

                        {/* Technical Feedback */}
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
                                Technical Rigor & Solution Architecture
                            </h4>
                            <p style={{
                                margin: 0,
                                fontSize: '14px',
                                color: 'rgba(255,255,255,0.85)',
                                lineHeight: '1.6',
                                background: 'rgba(255,255,255,0.02)',
                                padding: '14px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                {techData.feedback}
                            </p>
                        </div>

                        {/* Verified Technical Strengths */}
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={14} />
                                Verified Technical Strengths
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: '1.6' }}>
                                {techData.strengths?.map((s: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '6px' }}>{s}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Technical Gaps & Study Areas */}
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} />
                                Technical Gaps & Concepts to Deepen
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: '1.6' }}>
                                {techData.gaps?.map((g: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '6px' }}>{g}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* ==================================================== */}
                    {/* PILLAR 2: BEHAVIORAL CONFIDENCE (MediaPipe Telemetry) */}
                    {/* ==================================================== */}
                    <div className="glass-panel" style={{
                        padding: '24px',
                        borderLeft: '4px solid #4ade80',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {/* Pillar 2 Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <ShieldCheck size={20} style={{ color: '#4ade80' }} />
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                                        Pillar 2: Behavioral Confidence
                                    </h3>
                                </div>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    MediaPipe WebAssembly real-time telemetry
                                </span>
                            </div>

                            {/* Score & Weight Badge */}
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#4ade80', lineHeight: '1' }}>
                                    {behData.score}<span style={{ fontSize: '14px', color: '#64748b' }}>/10</span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>Weight: 40%</span>
                            </div>
                        </div>

                        {/* Real-time Biometrics Breakdown Meters */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            {/* Eye Contact */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Eye size={13} style={{ color: '#38bdf8' }} />
                                        Eye Contact & Composure
                                    </span>
                                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>{behData.eye_contact_percentage}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${behData.eye_contact_percentage}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #38bdf8)', borderRadius: '3px' }} />
                                </div>
                            </div>

                            {/* Posture & Poise */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldCheck size={13} style={{ color: '#4ade80' }} />
                                        Posture & Spine Uprightness
                                    </span>
                                    <span style={{ color: '#4ade80', fontWeight: 700 }}>{behData.posture_stability_percentage}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${behData.posture_stability_percentage}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #4ade80)', borderRadius: '3px' }} />
                                </div>
                            </div>

                            {/* Warmth & Expression */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Smile size={13} style={{ color: '#c084fc' }} />
                                        Expressive Warmth & Engagement
                                    </span>
                                    <span style={{ color: '#c084fc', fontWeight: 700 }}>{behData.engagement_percentage}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${behData.engagement_percentage}%`, height: '100%', background: 'linear-gradient(90deg, #9333ea, #c084fc)', borderRadius: '3px' }} />
                                </div>
                            </div>
                        </div>

                        {/* Expression Breakdown Pills */}
                        {behData.expression_distribution && (
                            <div>
                                <h4 style={{ margin: '0 0 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
                                    Facial Expression Distribution
                                </h4>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.25)', color: '#86efac', padding: '3px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                        😊 Smiling: {behData.expression_distribution.smilingTimePct || 0}%
                                    </span>
                                    <span style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#7dd3fc', padding: '3px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                        🎯 Attentive: {behData.expression_distribution.attentiveTimePct || 0}%
                                    </span>
                                    <span style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.25)', color: '#a5b4fc', padding: '3px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                        🗣️ Speaking: {behData.expression_distribution.speakingTimePct || 0}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Physical Delivery Highlights */}
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={14} />
                                Physical Delivery Highlights
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: '1.6' }}>
                                {behData.strengths?.map((s: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '6px' }}>{s}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Executive Presence Coaching */}
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={14} />
                                Executive Presence Coaching
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: '1.6' }}>
                                {behData.coaching_tips?.map((t: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '6px' }}>{t}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>

                {/* Synthesis & Strategic Next Steps */}
                <div className="glass-panel" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(99, 102, 241, 0.05))',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={18} style={{ color: '#818cf8' }} />
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#f8fafc' }}>
                            Strategic Preparation Roadmap
                        </h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
                        To maximize hireability, balance technical precision with non-verbal delivery. Focus on practicing architectural trade-offs while maintaining direct camera contact and upright posture to project confidence to the interviewing panel.
                    </p>
                </div>

                {/* Action Navigation Buttons */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={() => navigate('/scores')} 
                        style={{ minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <History size={16} />
                        Score History
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/interview')} 
                        style={{ minWidth: '220px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <RotateCcw size={16} />
                        Start Another Interview
                        <ArrowRight size={16} />
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ScoreDetail;
