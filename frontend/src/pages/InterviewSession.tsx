import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Loader2, StopCircle, Camera } from 'lucide-react';
import LoaderOverlay from '../components/LoaderOverlay';

const InterviewSession: React.FC = () => {
    const [question, setQuestion] = useState<string>('');
    const [answer, setAnswer] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [questionNumber, setQuestionNumber] = useState(1);

    const videoRef = useRef<HTMLVideoElement>(null);
    const recognitionRef = useRef<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedQuestion = localStorage.getItem('firstQuestion');
        if (storedQuestion) {
            setQuestion(storedQuestion);
        } else {
            navigate('/interview');
        }

        // Initialize camera
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing media devices.", err);
            }
        };

        startCamera();

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setAnswer(prev => prev + (prev ? ' ' : '') + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsRecording(false);
            };
        }

        return () => {
            // Cleanup camera stream
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            // Stop recording if active
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [navigate]);

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in your browser. Please type your answer.");
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim()) return alert('Please provide an answer.');

        // Stop recording before submitting to prevent speech recognition from capturing alerts
        if (isRecording) {
            toggleRecording();
        }

        setIsLoading(true);
        const username = localStorage.getItem('username');
        const domain = localStorage.getItem('domain');

        try {
            // 1. Submit answer
            const answerRes = await fetch('http://localhost:3000/api/addanswer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': username || ''
                },
                body: JSON.stringify({ answer })
            });

            if (!answerRes.ok) {
                const errData = await answerRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save your answer. Please try again.');
            }

            setAnswer('');

            // 2. Fetch next question
            const res = await fetch('http://localhost:3000/api/interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': username || ''
                },
                body: JSON.stringify({ domain })
            });

            const data = await res.json();

            if (!res.ok) {
                // Answer was saved, but next question failed (e.g. API overloaded)
                alert(data.error || 'Your answer was saved, but we could not load the next question. Please try clicking Submit again.');
                return;
            }

            if (data.question) {
                setQuestion(data.question);
                setQuestionNumber(prev => prev + 1);
            } else {
                alert("Interview sequence error.");
            }

        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to submit answer.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndInterview = async () => {
        if (window.confirm("Are you sure you want to end the interview and generate your score?")) {
            navigate('/score/detail');
        }
    };

    return (
        <>
            <LoaderOverlay 
                isVisible={isLoading} 
                text="Processing Response..." 
                subText="Please wait while the AI Interviewer evaluates your answer and generates the next question." 
            />
            <style>{`
                .interview-session-wrapper {
                    min-height: 100vh;
                    overflow-y: auto;
                    padding: 24px;
                    padding-bottom: 48px;
                }
                .interview-session-container {
                    max-width: 1000px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .interview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .interview-grid {
                    display: grid;
                    grid-template-columns: 1fr 280px;
                    gap: 24px;
                    align-items: start;
                }
                .interview-main {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    min-width: 0;
                }
                .interview-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    position: sticky;
                    top: 24px;
                }
                .mic-btn-wrapper {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                @media (max-width: 820px) {
                    .interview-grid {
                        grid-template-columns: 1fr;
                    }
                    .interview-sidebar {
                        position: static;
                        order: -1;
                    }
                    .interview-sidebar .camera-video-container {
                        aspect-ratio: 16/9;
                    }
                }
                @media (max-width: 480px) {
                    .interview-session-wrapper {
                        padding: 12px;
                        padding-bottom: 32px;
                    }
                    .interview-header h2 {
                        font-size: 18px !important;
                    }
                    .end-interview-btn span {
                        display: none;
                    }
                }
            `}</style>
            <div className="interview-session-wrapper">
                <div className="interview-session-container">

                    {/* Header */}
                    <div className="interview-header">
                        <div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Mock Interview Session</h2>
                            <p style={{ margin: 0, color: '#818cf8', fontSize: '14px', marginTop: '4px' }}>
                                Question {questionNumber} • {localStorage.getItem('domain')}
                            </p>
                        </div>
                        <button
                            onClick={handleEndInterview}
                            className="end-interview-btn"
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, flexShrink: 0 }}
                        >
                            <StopCircle size={18} />
                            <span>End Interview</span>
                        </button>
                    </div>

                    {/* Two-column grid */}
                    <div className="interview-grid">
                        {/* Main Content Area */}
                        <div className="interview-main">

                            {/* Question Card */}
                            <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #818cf8' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8' }}>AI Interviewer</h3>
                                <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.6', color: '#f8fafc' }}>
                                    {question}
                                </p>
                            </div>

                            {/* Answer Area */}
                            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="mic-btn-wrapper">
                                    <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Your Answer</h3>

                                    <button
                                        onClick={toggleRecording}
                                        style={{
                                            background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                            color: isRecording ? 'white' : '#94a3b8',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            transition: 'all 0.3s',
                                            flexShrink: 0
                                        }}
                                    >
                                        {isRecording ? <Mic size={16} className="animate-pulse" /> : <MicOff size={16} />}
                                        {isRecording ? 'Listening...' : 'Use Microphone'}
                                    </button>
                                </div>

                                <textarea
                                    className="glass-input"
                                    style={{ minHeight: '150px', resize: 'vertical', fontSize: '15px', lineHeight: '1.5' }}
                                    placeholder="Type your answer here or use the microphone to speak..."
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleSubmitAnswer}
                                        disabled={isLoading}
                                        style={{ width: 'auto', padding: '12px 24px' }}
                                    >
                                        {isLoading ? (
                                            <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                                        ) : (
                                            <><Send size={18} /> Submit Answer</>
                                        )}
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Sidebar (Camera) */}
                        <div className="interview-sidebar">
                            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', width: '100%', justifyContent: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Camera size={16} />
                                    <span>Camera Feed</span>
                                </div>

                                <div className="camera-video-container" style={{
                                    width: '100%',
                                    aspectRatio: '3/4',
                                    background: '#000',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                                }}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            transform: 'scaleX(-1)' // Mirror effect
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default InterviewSession;
