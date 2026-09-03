import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { Target, Loader2, AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface GapAnalysisResult {
    missingSkills: string[];
    weakAreas: string[];
    strengthAreas: string[];
    overallFit: string;
    recommendations: string;
}

const ResumeAnalysis: React.FC = () => {
    const [image, setImage] = useState<string | null>(null);
    const [profile, setProfile] = useState('frontend');
    const [isLoading, setIsLoading] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [isGapLoading, setIsGapLoading] = useState(false);
    const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
    const [gapError, setGapError] = useState('');
    const navigate = useNavigate();

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleReview = async () => {
        if (!image) return alert('Upload image first');
        setIsLoading(true);
        try {
            const { data: { text } } = await Tesseract.recognize(image, 'eng');
            setExtractedText(text);
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            const res = await fetch('http://localhost:3000/api/checkresume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'jwttoken': token
                },
                body: JSON.stringify({ resume: text, profile })
            });
            const data = await res.json();
            localStorage.setItem('resumeAnalysis', JSON.stringify(data));
            navigate('/result');
        } catch (err) {
            alert('Analysis failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGapAnalysis = async () => {
        if (!extractedText && !image) {
            alert('Upload and review your resume first');
            return;
        }

        setIsGapLoading(true);
        setGapError('');
        setGapResult(null);

        try {
            let resumeText = extractedText;
            if (!resumeText && image) {
                const { data: { text } } = await Tesseract.recognize(image, 'eng');
                resumeText = text;
                setExtractedText(text);
            }

            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            const data = await api.rag.gapAnalysis(resumeText, token);

            if (data.error) {
                setGapError(data.error);
            } else if (data.analysis) {
                setGapResult(data.analysis);
            }
        } catch {
            setGapError('Failed to run gap analysis. Please try again.');
        } finally {
            setIsGapLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '70vh', padding: '20px 0' }}>
            <div className="glass-panel" style={{ maxWidth: '650px', width: '100%' }}>
                <div className="glass-header">
                    <h2>AI Resume Analysis</h2>
                    <p>Upload your resume to get instant feedback and gap analysis</p>
                </div>

                <div className="glass-input-group">
                    <label>Upload Resume (Image)</label>
                    <div style={{ 
                        border: '2px dashed rgba(255,255,255,0.2)', 
                        padding: '30px', 
                        borderRadius: '16px', 
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        <input 
                            type="file" 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            style={{ 
                                color: 'rgba(255,255,255,0.7)',
                                background: 'transparent',
                                width: '100%'
                            }} 
                        />
                        {image && (
                            <img 
                                src={image} 
                                alt="Preview" 
                                style={{ 
                                    marginTop: '20px', 
                                    maxWidth: '100%', 
                                    maxHeight: '300px', 
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }} 
                            />
                        )}
                    </div>
                </div>

                <div className="glass-input-group">
                    <label>Target Profile</label>
                    <select 
                        className="glass-select" 
                        value={profile} 
                        onChange={(e) => setProfile(e.target.value)}
                    >
                        <option value="frontend" style={{ background: '#0a0a12' }}>Frontend Developer</option>
                        <option value="backend" style={{ background: '#0a0a12' }}>Backend Developer</option>
                        <option value="devops" style={{ background: '#0a0a12' }}>DevOps Engineer</option>
                        <option value="ML" style={{ background: '#0a0a12' }}>Machine Learning Engineer</option>
                    </select>
                </div>

                <button 
                    className="btn-primary" 
                    onClick={handleReview} 
                    disabled={isLoading}
                    style={{ marginBottom: '32px' }}
                >
                    {isLoading ? 'Analyzing Resume...' : 'Get General Review'}
                </button>

                {/* Gap Analysis Section */}
                <div style={{
                    padding: '24px',
                    background: 'rgba(99, 102, 241, 0.05)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '16px',
                }}>
                    <h3 style={{ color: '#a5b4fc', margin: '0 0 8px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={20} color="#818cf8" />
                        Grounded Gap Analysis
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>
                        Compare your resume against your uploaded job descriptions to see if you meet the specific requirements.
                    </p>
                    
                    <button
                        onClick={handleGapAnalysis}
                        disabled={isGapLoading || !image}
                        className="btn-secondary"
                        style={{ 
                            width: '100%', 
                            background: 'rgba(139, 92, 246, 0.15)',
                            borderColor: 'rgba(139, 92, 246, 0.3)',
                            color: '#e2e8f0',
                            opacity: (!image || isGapLoading) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {isGapLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Cross-referencing with Job Descriptions...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Analyze Against Job Descriptions
                            </>
                        )}
                    </button>

                    {gapError && (
                        <p style={{ color: '#f87171', fontSize: '14px', marginTop: '16px', textAlign: 'center' }}>
                            {gapError}
                        </p>
                    )}

                    {gapResult && (
                        <div style={{ marginTop: '24px' }}>
                            {/* Overall Fit */}
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                padding: '16px',
                                borderRadius: '12px',
                                marginBottom: '16px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>Overall Fit</strong>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                                    {gapResult.overallFit}
                                </p>
                            </div>

                            {/* Missing Skills */}
                            {gapResult.missingSkills?.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <strong style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <AlertTriangle size={16} color="#f87171" />
                                        Missing Requirements
                                    </strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {gapResult.missingSkills.map((skill, i) => (
                                            <span key={i} style={{
                                                background: 'rgba(248,113,113,0.1)',
                                                border: '1px solid rgba(248,113,113,0.2)',
                                                color: '#fca5a5',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                            }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Strengths */}
                            {gapResult.strengthAreas?.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <strong style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <CheckCircle2 size={16} color="#4ade80" />
                                        Key Strengths
                                    </strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {gapResult.strengthAreas.map((area, i) => (
                                            <span key={i} style={{
                                                background: 'rgba(74,222,128,0.1)',
                                                border: '1px solid rgba(74,222,128,0.2)',
                                                color: '#86efac',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                            }}>
                                                {area}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations */}
                            {gapResult.recommendations && (
                                <div style={{
                                    background: 'rgba(99,102,241,0.08)',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    marginTop: '16px',
                                    border: '1px solid rgba(99,102,241,0.15)'
                                }}>
                                    <strong style={{ color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <Lightbulb size={16} color="#a5b4fc" />
                                        Recommendations to Improve
                                    </strong>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                                        {gapResult.recommendations}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumeAnalysis;
