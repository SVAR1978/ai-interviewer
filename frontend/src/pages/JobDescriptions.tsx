import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardList, Inbox, Puzzle, Calendar, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import LoaderOverlay from '../components/LoaderOverlay';

interface JDItem {
    _id: string;
    title: string;
    company: string;
    chunkCount: number;
    createdAt: string;
}

const JobDescriptions: React.FC = () => {
    const [title, setTitle] = useState('');
    const [company, setCompany] = useState('');
    const [rawText, setRawText] = useState('');
    const [jds, setJds] = useState<JDItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('jwttoken');
        if (!token) {
            navigate('/signin');
            return;
        }
        fetchJDs();
    }, [navigate]);

    const fetchJDs = async () => {
        try {
            const token = localStorage.getItem('jwttoken');
            if (!token) return;
            const data = await api.rag.listJDs(token);
            if (data.jobDescriptions) {
                setJds(data.jobDescriptions);
            }
        } catch {
            console.error('Failed to fetch job descriptions');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !rawText.trim()) {
            setStatusMsg({ text: 'Please fill in the title and job description.', type: 'error' });
            return;
        }
        if (rawText.trim().length < 50) {
            setStatusMsg({ text: 'Job description is too short. Please paste the full JD.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatusMsg(null);

        try {
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            const data = await api.rag.ingestJD(title.trim(), rawText.trim(), token, company.trim());

            if (data.error) {
                setStatusMsg({ text: data.error, type: 'error' });
            } else {
                setStatusMsg({
                    text: `"${data.jobDescription.title}" ingested — ${data.jobDescription.chunkCount} chunks embedded`,
                    type: 'success'
                });
                setTitle('');
                setCompany('');
                setRawText('');
                fetchJDs();
            }
        } catch (err) {
            setStatusMsg({ text: 'Failed to ingest job description. Please try again.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, jdTitle: string) => {
        if (!confirm(`Delete "${jdTitle}"? This will remove all embedded chunks.`)) return;

        try {
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/signin');

            const data = await api.rag.deleteJD(id, token);
            if (data.error) {
                setStatusMsg({ text: data.error, type: 'error' });
            } else {
                setStatusMsg({ text: `Deleted "${jdTitle}"`, type: 'success' });
                fetchJDs();
            }
        } catch {
            setStatusMsg({ text: 'Failed to delete. Please try again.', type: 'error' });
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    return (
        <>
            <LoaderOverlay 
                isVisible={isLoading} 
                text="Embedding & Processing..." 
                subText="Please wait while the AI analyzes and embeds the job description." 
            />
            <div style={{ padding: '20px 0' }}>
            <div className="glass-header">
                <h2>Job Description Manager</h2>
                <p>Upload JDs to ground your AI interviews and resume gap analysis</p>
            </div>

            <div className="dashboard-grid" style={{ alignItems: 'start' }}>
                {/* Upload Form */}
                <div className="glass-panel">
                    <h3 style={{ margin: '0 0 20px', color: '#e2e8f0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={20} color="#818cf8" />
                        Upload New JD
                    </h3>

                    {statusMsg && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '14px',
                            background: statusMsg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                            color: statusMsg.type === 'success' ? '#86efac' : '#fca5a5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{statusMsg.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="glass-input-group">
                            <label>Job Title *</label>
                            <input
                                className="glass-input"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Senior React Developer"
                            />
                        </div>

                        <div className="glass-input-group">
                            <label>Company (optional)</label>
                            <input
                                className="glass-input"
                                type="text"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                placeholder="e.g. Google, Amazon"
                            />
                        </div>

                        <div className="glass-input-group">
                            <label>Job Description Text *</label>
                            <textarea
                                className="glass-textarea"
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                placeholder="Paste the full job description here..."
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Embedding & Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    Ingest Job Description
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* JD List */}
                <div className="glass-panel">
                    <h3 style={{ margin: '0 0 20px', color: '#e2e8f0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ClipboardList size={20} color="#818cf8" />
                        Your Job Descriptions ({jds.length})
                    </h3>

                    {jds.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '12px',
                            border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                <Inbox size={44} color="rgba(255,255,255,0.25)" />
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 8px' }}>No job descriptions uploaded yet.</p>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Paste a JD to get started with grounded interviews.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {jds.map((jd) => (
                                <div key={jd._id} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#fff', fontSize: '16px' }}>{jd.title}</div>
                                            {jd.company && (
                                                <div style={{ color: '#a5b4fc', fontSize: '13px', marginTop: '4px' }}>@ {jd.company}</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(jd._id, jd.title)}
                                            style={{
                                                background: 'rgba(248,113,113,0.1)',
                                                color: '#f87171',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <span style={{ 
                                            fontSize: '12px', 
                                            background: 'rgba(99,102,241,0.1)', 
                                            color: '#a5b4fc', 
                                            padding: '4px 8px', 
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Puzzle size={12} />
                                            {jd.chunkCount} chunks
                                        </span>
                                        <span style={{ 
                                            fontSize: '12px', 
                                            background: 'rgba(255,255,255,0.05)', 
                                            color: 'rgba(255,255,255,0.6)', 
                                            padding: '4px 8px', 
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Calendar size={12} />
                                            {formatDate(jd.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
};

export default JobDescriptions;
