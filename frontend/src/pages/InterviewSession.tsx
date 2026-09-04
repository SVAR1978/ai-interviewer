import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Loader2, StopCircle, Camera } from 'lucide-react';
import { api } from '../services/api';

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

        setIsLoading(true);
        const username = localStorage.getItem('username');
        const domain = localStorage.getItem('domain');

        try {
            // 1. Submit answer
            await fetch('http://localhost:3000/api/addanswer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': username || ''
                },
                body: JSON.stringify({ answer })
            });

            setAnswer('');
            if (isRecording) {
                toggleRecording(); // stop recording on submit
            }

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

            if (data.question) {
                setQuestion(data.question);
                setQuestionNumber(prev => prev + 1);
            } else {
                alert("Interview sequence error.");
            }

        } catch (err) {
            console.error(err);
            alert("Failed to submit answer.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndInterview = async () => {
        if (window.confirm("Are you sure you want to end the interview and generate your score?")) {
            navigate('/scores');
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Mock Interview Session</h2>
                    <p style={{ margin: 0, color: '#818cf8', fontSize: '14px', marginTop: '4px' }}>
                        Question {questionNumber} • {localStorage.getItem('domain')}
                    </p>
                </div>
                <button
                    onClick={handleEndInterview}
                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}
                >
                    <StopCircle size={18} />
                    End Interview
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Question Card */}
                    <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #818cf8' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8' }}>AI Interviewer</h3>
                        <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.6', color: '#f8fafc' }}>
                            {question}
                        </p>
                    </div>

                    {/* Answer Area */}
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                    transition: 'all 0.3s'
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', width: '100%', justifyContent: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Camera size={16} />
                            <span>Camera Feed</span>
                        </div>

                        <div style={{
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
    );
};

export default InterviewSession;
