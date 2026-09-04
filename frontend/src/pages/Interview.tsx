import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import LoaderOverlay from '../components/LoaderOverlay';

interface JDItem {
    _id: string;
    title: string;
    company: string;
}

const Interview: React.FC = () => {
    const [domain, setDomain] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [jds, setJds] = useState<JDItem[]>([]);
    const [selectedJD, setSelectedJD] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('jwttoken');
        if (token) {
            api.rag.listJDs(token).then(data => {
                if (data.jobDescriptions) setJds(data.jobDescriptions);
            }).catch(() => {});
        }
    }, []);

    const handleStart = async () => {
        if (!domain) return alert('Enter domain');
        setIsLoading(true);
        const user = localStorage.getItem('username');
        if (!user) return navigate('/signin');

        try {
            const res = await fetch('http://localhost:3000/api/interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': user
                },
                body: JSON.stringify({
                    domain,
                    jobDescriptionId: selectedJD || undefined
                })
            });
            const data = await res.json();
            localStorage.setItem('firstQuestion', data.question);
            localStorage.setItem('domain', domain);
            if (data.ragGrounded) {
                localStorage.setItem('ragGrounded', 'true');
                const jd = jds.find(j => j._id === selectedJD);
                if (jd) localStorage.setItem('ragJDTitle', jd.title + (jd.company ? ` @ ${jd.company}` : ''));
            } else {
                localStorage.removeItem('ragGrounded');
                localStorage.removeItem('ragJDTitle');
            }
            navigate('/interview/session');
        } catch (err) {
            alert('Failed to start interview');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <LoaderOverlay 
                isVisible={isLoading} 
                text="Generating Questions..." 
                subText="Please wait while the AI prepares your customized interview." 
            />
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
            <div className="glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
                <div className="glass-header">
                    <h2>Start Mock Interview</h2>
                    <p>Customize your AI interview session</p>
                </div>

                <div className="glass-input-group">
                    <label>Interview Domain</label>
                    <input 
                        className="glass-input"
                        type="text" 
                        value={domain} 
                        onChange={(e) => setDomain(e.target.value)} 
                        placeholder="e.g. Frontend Developer, Data Scientist"
                        required 
                    />
                </div>

                {jds.length > 0 && (
                    <div className="glass-input-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Target size={16} color="#818cf8" />
                            Grounding (Optional Job Description)
                        </label>
                        <select
                            className="glass-select"
                            value={selectedJD}
                            onChange={(e) => setSelectedJD(e.target.value)}
                        >
                            <option value="" style={{ background: '#0a0a12' }}>
                                General Questions (No JD)
                            </option>
                            {jds.map(jd => (
                                <option key={jd._id} value={jd._id} style={{ background: '#0a0a12' }}>
                                    {jd.title}{jd.company ? ` @ ${jd.company}` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedJD && (
                            <p style={{
                                fontSize: '13px',
                                color: '#818cf8',
                                marginTop: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                                Questions will be tailored to this JD
                            </p>
                        )}
                    </div>
                )}

                <button 
                    className="btn-primary" 
                    onClick={handleStart} 
                    disabled={isLoading}
                    style={{ marginTop: '32px' }}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Generating Questions...
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} />
                            Start Session
                        </>
                    )}
                </button>
            </div>
        </div>
        </>
    );
};

export default Interview;
