import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, AlertTriangle, CheckCircle2, Lightbulb, Sparkles, FileText, Upload, XCircle } from 'lucide-react';
import { api } from '../services/api';
import LoaderOverlay from '../components/LoaderOverlay';

interface GapAnalysisResult {
    missingSkills: string[];
    weakAreas: string[];
    strengthAreas: string[];
    overallFit: string;
    recommendations: string;
}

interface ResumeResult {
    score: string;
    summary: string;
    strengths: string[];
    improvements: string[];
    missing_skills: string[];
    formatting_tips: string[];
    ats_score: string;
    ats_feedback: string;
    resumeText?: string;
}

const ResumeAnalysis: React.FC = () => {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [profile, setProfile] = useState('frontend');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ResumeResult | null>(null);
    const [error, setError] = useState('');

    // Gap analysis state
    const [isGapLoading, setIsGapLoading] = useState(false);
    const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
    const [gapError, setGapError] = useState('');

    const navigate = useNavigate();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                setError('Please upload a PDF file.');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB.');
                return;
            }
            setPdfFile(file);
            setError('');
            setResult(null);
        }
    };

    const handleReview = async () => {
        if (!pdfFile) return setError('Please upload a PDF resume first.');
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('resume', pdfFile);
            formData.append('profile', profile);

            const res = await fetch('http://localhost:3000/api/checkresume', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to analyze resume. Please try again.');
                return;
            }

            setResult(data);
        } catch (err) {
            setError('Failed to connect to the server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGapAnalysis = async () => {
        if (!pdfFile) {
            setGapError('Upload your resume first.');
            return;
        }

        setIsGapLoading(true);
        setGapError('');
        setGapResult(null);

        try {
            // Read PDF text on the fly for gap analysis
            const formData = new FormData();
            formData.append('resume', pdfFile);
            formData.append('profile', profile);

            // First extract text by sending to our endpoint — but gap analysis uses the RAG api
            // We need the text, so let's read the file and send it
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            let resumeContent = result?.resumeText || (result ? (result.summary + '\n' + result.strengths.join('\n')) : '');

            // If we don't have text yet, extract it from the uploaded PDF
            if (!resumeContent) {
                const formData = new FormData();
                formData.append('resume', pdfFile);
                formData.append('profile', profile);

                const extractRes = await fetch('http://localhost:3000/api/checkresume', {
                    method: 'POST',
                    body: formData
                });
                const extractData = await extractRes.json();
                if (extractRes.ok && extractData) {
                    setResult(extractData);
                    resumeContent = extractData.resumeText || extractData.summary || '';
                } else {
                    setGapError(extractData.error || 'Failed to extract text from your resume.');
                    setIsGapLoading(false);
                    return;
                }
            }

            const data = await api.rag.gapAnalysis(resumeContent, token);

            if (data.error) {
                if (data.error.toLowerCase().includes('token') || data.error.toLowerCase().includes('session')) {
                    setGapError('Session expired. Redirecting to sign in...');
                    localStorage.removeItem('jwttoken');
                    setTimeout(() => navigate('/signin'), 1500);
                    return;
                }
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

    const getScoreColor = (score: string) => {
        const num = parseInt(score) || 0;
        if (num >= 8) return '#4ade80';
        if (num >= 6) return '#facc15';
        if (num >= 4) return '#fb923c';
        return '#f87171';
    };

    return (
        <>
            <LoaderOverlay 
                isVisible={isLoading || isGapLoading} 
                text={isGapLoading ? "Running Gap Analysis..." : "Analyzing Resume..."} 
                subText="Please wait while the AI analyzes your resume against the target profile." 
            />
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '70vh', padding: '20px 0' }}>
                <div style={{ maxWidth: '750px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Upload Card */}
                    <div className="glass-panel">
                        <div className="glass-header">
                            <h2>AI Resume Analysis</h2>
                            <p>Upload your resume as PDF to get detailed AI-powered feedback</p>
                        </div>

                        {/* PDF Upload */}
                        <div className="glass-input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={16} color="#818cf8" />
                                Upload Resume (PDF)
                            </label>
                            <div 
                                style={{ 
                                    border: `2px dashed ${pdfFile ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.2)'}`, 
                                    padding: '30px', 
                                    borderRadius: '16px', 
                                    textAlign: 'center',
                                    background: pdfFile ? 'rgba(74,222,128,0.03)' : 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.3s',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                onClick={() => document.getElementById('pdf-upload')?.click()}
                            >
                                <input 
                                    id="pdf-upload"
                                    type="file" 
                                    onChange={handleFileUpload} 
                                    accept=".pdf,application/pdf" 
                                    style={{ display: 'none' }}
                                />
                                {pdfFile ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                        <FileText size={32} color="#4ade80" />
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ margin: 0, color: '#4ade80', fontWeight: 600, fontSize: '15px' }}>
                                                {pdfFile.name}
                                            </p>
                                            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                                                {(pdfFile.size / 1024).toFixed(1)} KB • Click to change
                                            </p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setPdfFile(null); setResult(null); }}
                                            style={{ 
                                                background: 'rgba(248,113,113,0.15)', 
                                                border: '1px solid rgba(248,113,113,0.3)',
                                                borderRadius: '8px',
                                                padding: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                marginLeft: 'auto'
                                            }}
                                        >
                                            <XCircle size={16} color="#f87171" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={40} color="rgba(255,255,255,0.3)" style={{ marginBottom: '12px' }} />
                                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                                            Click to upload or drag & drop your PDF resume
                                        </p>
                                        <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                                            Maximum file size: 10MB
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Target Profile */}
                        <div className="glass-input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={16} color="#818cf8" />
                                Target Profile
                            </label>
                            <select 
                                className="glass-select" 
                                value={profile} 
                                onChange={(e) => { setProfile(e.target.value); setResult(null); }}
                            >
                                <option value="frontend" style={{ background: '#0a0a12' }}>Frontend Developer</option>
                                <option value="backend" style={{ background: '#0a0a12' }}>Backend Developer</option>
                                <option value="fullstack" style={{ background: '#0a0a12' }}>Full Stack Developer</option>
                                <option value="devops" style={{ background: '#0a0a12' }}>DevOps Engineer</option>
                                <option value="data-scientist" style={{ background: '#0a0a12' }}>Data Scientist</option>
                                <option value="ML" style={{ background: '#0a0a12' }}>Machine Learning Engineer</option>
                                <option value="cybersecurity" style={{ background: '#0a0a12' }}>Cybersecurity Analyst</option>
                                <option value="cloud-architect" style={{ background: '#0a0a12' }}>Cloud Architect</option>
                                <option value="product-manager" style={{ background: '#0a0a12' }}>Product Manager</option>
                            </select>
                        </div>

                        {error && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                background: 'rgba(248,113,113,0.1)',
                                border: '1px solid rgba(248,113,113,0.2)',
                                color: '#fca5a5',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}

                        <button 
                            className="btn-primary" 
                            onClick={handleReview} 
                            disabled={isLoading || !pdfFile}
                            style={{ marginTop: '8px' }}
                        >
                            <Sparkles size={16} />
                            Analyze Resume
                        </button>
                    </div>

                    {/* Results */}
                    {result && (
                        <>
                            {/* Score Header */}
                            <div className="glass-panel">
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '16px',
                                    marginBottom: '20px'
                                }}>
                                    <h2 style={{ 
                                        margin: 0, 
                                        fontSize: '24px', 
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #fff, #a5b4fc)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent'
                                    }}>
                                        Resume Analysis Report
                                    </h2>
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                                                Resume Score
                                            </div>
                                            <div style={{ fontSize: '32px', fontWeight: 800, color: getScoreColor(result.score) }}>
                                                {result.score}<span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>/10</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                                                ATS Score
                                            </div>
                                            <div style={{ fontSize: '32px', fontWeight: 800, color: getScoreColor(result.ats_score) }}>
                                                {result.ats_score}<span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>/10</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div style={{ 
                                    background: 'rgba(255,255,255,0.03)', 
                                    padding: '20px', 
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: 'rgba(255,255,255,0.8)',
                                    lineHeight: '1.7',
                                    fontSize: '15px'
                                }}>
                                    {result.summary}
                                </div>
                            </div>

                            {/* Strengths & Improvements */}
                            <div className="dashboard-grid" style={{ alignItems: 'start' }}>
                                {/* Strengths */}
                                <div className="glass-panel" style={{ 
                                    background: 'rgba(74,222,128,0.03)', 
                                    border: '1px solid rgba(74,222,128,0.15)'
                                }}>
                                    <h3 style={{ color: '#4ade80', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={20} />
                                        Key Strengths
                                    </h3>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.7', fontSize: '14px' }}>
                                        {result.strengths.map((s, i) => (
                                            <li key={i} style={{ marginBottom: '10px' }}>{s}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Improvements */}
                                <div className="glass-panel" style={{ 
                                    background: 'rgba(248,113,113,0.03)', 
                                    border: '1px solid rgba(248,113,113,0.15)'
                                }}>
                                    <h3 style={{ color: '#f87171', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertTriangle size={20} />
                                        Areas for Improvement
                                    </h3>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.7', fontSize: '14px' }}>
                                        {result.improvements.map((s, i) => (
                                            <li key={i} style={{ marginBottom: '10px' }}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Missing Skills */}
                            {result.missing_skills.length > 0 && (
                                <div className="glass-panel">
                                    <h3 style={{ color: '#facc15', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Target size={20} />
                                        Missing Skills for {profile.charAt(0).toUpperCase() + profile.slice(1)} Role
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {result.missing_skills.map((skill, i) => (
                                            <span key={i} style={{
                                                background: 'rgba(250,204,21,0.1)',
                                                border: '1px solid rgba(250,204,21,0.2)',
                                                color: '#fde68a',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                            }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Formatting Tips & ATS */}
                            <div className="dashboard-grid" style={{ alignItems: 'start' }}>
                                {result.formatting_tips.length > 0 && (
                                    <div className="glass-panel">
                                        <h3 style={{ color: '#a5b4fc', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Lightbulb size={20} />
                                            Formatting Tips
                                        </h3>
                                        <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.7', fontSize: '14px' }}>
                                            {result.formatting_tips.map((tip, i) => (
                                                <li key={i} style={{ marginBottom: '10px' }}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="glass-panel">
                                    <h3 style={{ color: '#38bdf8', fontSize: '18px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FileText size={20} />
                                        ATS Compatibility
                                    </h3>
                                    <div style={{ 
                                        background: 'rgba(255,255,255,0.03)', 
                                        padding: '16px', 
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.8)',
                                        lineHeight: '1.7',
                                        fontSize: '14px'
                                    }}>
                                        {result.ats_feedback}
                                    </div>
                                </div>
                            </div>

                            {/* Gap Analysis Section */}
                            <div className="glass-panel" style={{
                                background: 'rgba(99, 102, 241, 0.03)',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
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
                                    disabled={isGapLoading}
                                    className="btn-secondary"
                                    style={{ 
                                        width: '100%', 
                                        background: 'rgba(139, 92, 246, 0.15)',
                                        borderColor: 'rgba(139, 92, 246, 0.3)',
                                        color: '#e2e8f0',
                                        opacity: isGapLoading ? 0.5 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Sparkles size={16} />
                                    {isGapLoading ? 'Cross-referencing with Job Descriptions...' : 'Analyze Against Job Descriptions'}
                                </button>

                                {gapError && (
                                    <p style={{ color: '#f87171', fontSize: '14px', marginTop: '16px', textAlign: 'center' }}>
                                        {gapError}
                                    </p>
                                )}

                                {gapResult && (
                                    <div style={{ marginTop: '24px' }}>
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
                                            {gapResult.overallFit.toLowerCase().includes('no job description') && (
                                                <button
                                                    onClick={() => navigate('/job-descriptions')}
                                                    className="btn-primary"
                                                    style={{
                                                        marginTop: '12px',
                                                        fontSize: '13px',
                                                        padding: '8px 16px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <FileText size={14} /> Upload Job Description
                                                </button>
                                            )}
                                        </div>

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
                        </>
                    )}

                </div>
            </div>
        </>
    );
};

export default ResumeAnalysis;
