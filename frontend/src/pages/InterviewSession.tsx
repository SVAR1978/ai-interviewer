import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Loader2, StopCircle, Camera, Volume2, VolumeX } from 'lucide-react';
import LoaderOverlay from '../components/LoaderOverlay';

const InterviewSession: React.FC = () => {
    const [question, setQuestion] = useState<string>('');
    const [answer, setAnswer] = useState<string>('');
    const [interimText, setInterimText] = useState<string>('');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [questionNumber, setQuestionNumber] = useState<number>(1);

    const videoRef = useRef<HTMLVideoElement>(null);
    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef<boolean>(false);
    const isSpeakingRef = useRef<boolean>(false);
    const navigate = useNavigate();

    // Keep refs in sync with state for event listeners
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    // Choose the most natural English voice available
    const getPreferredVoice = (): SpeechSynthesisVoice | null => {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices();
        return (
            voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex'))) ||
            voices.find(v => v.lang.startsWith('en')) ||
            voices[0] ||
            null
        );
    };

    // Text-to-Speech: Read question aloud, then automatically start listening
    const speakQuestion = (textToSpeak?: string) => {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis is not supported in this browser.');
            return;
        }

        const text = textToSpeak || question;
        if (!text) return;

        // Cancel any currently playing speech
        window.speechSynthesis.cancel();

        // Pause microphone while speaking so it doesn't transcribe the computer's voice
        if (isRecordingRef.current && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {}
            setIsRecording(false);
            isRecordingRef.current = false;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        const voice = getPreferredVoice();
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            // After reading the question, automatically start listening for candidate's answer
            startListening();
        };

        utterance.onerror = (e) => {
            console.warn('Speech synthesis error:', e);
            setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    // Stop TTS speaking
    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
    };

    // Toggle speaker on/off
    const toggleSpeaking = () => {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            speakQuestion();
        }
    };

    // Speech-to-Text: Start listening
    const startListening = () => {
        if (!recognitionRef.current) return;
        try {
            isRecordingRef.current = true;
            setIsRecording(true);
            recognitionRef.current.start();
        } catch {
            // Already started or busy
        }
    };

    // Speech-to-Text: Stop listening
    const stopListening = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        setInterimText('');
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {}
        }
    };

    // Toggle microphone
    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in your browser. Please type your answer.");
            return;
        }

        if (isRecording) {
            stopListening();
        } else {
            // If AI is currently reading the question, stop speech first
            if (isSpeaking) {
                stopSpeaking();
            }
            startListening();
        }
    };

    useEffect(() => {
        const storedQuestion = localStorage.getItem('firstQuestion');
        if (storedQuestion) {
            setQuestion(storedQuestion);
            // Read first question automatically after a short delay so voices initialize
            setTimeout(() => {
                speakQuestion(storedQuestion);
            }, 600);
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

        // Ensure voices are loaded
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let currentFinal = '';
                let currentInterim = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        currentFinal += transcript;
                    } else {
                        currentInterim += transcript;
                    }
                }

                if (currentFinal) {
                    setAnswer(prev => {
                        const trimmedPrev = prev.trim();
                        const trimmedFinal = currentFinal.trim();
                        return trimmedPrev ? `${trimmedPrev} ${trimmedFinal}` : trimmedFinal;
                    });
                    setInterimText('');
                } else if (currentInterim) {
                    setInterimText(currentInterim);
                }
            };

            recognition.onerror = (event: any) => {
                console.warn("Speech recognition notice:", event.error);
                if (event.error === 'not-allowed') {
                    stopListening();
                    alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
                }
            };

            recognition.onend = () => {
                // If user hasn't explicitly stopped recording, auto-restart (handles Chrome silence timeout)
                if (isRecordingRef.current) {
                    try {
                        recognition.start();
                    } catch {}
                } else {
                    setIsRecording(false);
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            // Cleanup camera stream
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            // Stop recording
            if (recognitionRef.current) {
                isRecordingRef.current = false;
                try { recognitionRef.current.stop(); } catch {}
            }
            // Stop speech synthesis
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [navigate]);

    const handleSubmitAnswer = async () => {
        const fullAnswer = answer.trim();
        if (!fullAnswer) return alert('Please provide an answer.');

        // Stop listening & speaking before submitting
        stopListening();
        stopSpeaking();

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
                body: JSON.stringify({ answer: fullAnswer })
            });

            if (!answerRes.ok) {
                const errData = await answerRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save your answer. Please try again.');
            }

            setAnswer('');
            setInterimText('');

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
                alert(data.error || 'Your answer was saved, but we could not load the next question. Please try clicking Submit again.');
                return;
            }

            if (data.question) {
                setQuestion(data.question);
                setQuestionNumber(prev => prev + 1);
                // Read next question automatically and then listen
                setTimeout(() => {
                    speakQuestion(data.question);
                }, 400);
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
        stopSpeaking();
        stopListening();
        if (window.confirm("Are you sure you want to end the interview and generate your score?")) {
            navigate('/score/detail');
        }
    };

    return (
        <>
            <LoaderOverlay 
                isVisible={isLoading} 
                text="Processing Response..." 
                subText="The AI is reviewing your answer and preparing the next question." 
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
                .speaker-btn {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    color: #94a3b8;
                    border-radius: 20px;
                    padding: 6px 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .speaker-btn:hover {
                    background: rgba(99, 102, 241, 0.15);
                    border-color: rgba(99, 102, 241, 0.4);
                    color: #a5b4fc;
                }
                .speaker-btn.active {
                    background: rgba(99, 102, 241, 0.25);
                    border-color: #818cf8;
                    color: #818cf8;
                    box-shadow: 0 0 14px rgba(99, 102, 241, 0.35);
                }
                .sound-wave {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    height: 12px;
                }
                .sound-wave span {
                    display: inline-block;
                    width: 2px;
                    height: 100%;
                    background-color: #818cf8;
                    border-radius: 2px;
                    animation: wave 1s ease-in-out infinite;
                }
                .sound-wave span:nth-child(2) { animation-delay: 0.2s; }
                .sound-wave span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes wave {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
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

                            {/* Question Card with Speaker Button */}
                            <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #818cf8' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        AI Interviewer
                                        {isSpeaking && (
                                            <span style={{ fontSize: '11px', textTransform: 'none', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <div className="sound-wave">
                                                    <span></span>
                                                    <span></span>
                                                    <span></span>
                                                </div>
                                                Reading question...
                                            </span>
                                        )}
                                    </h3>

                                    {/* Functional Speaker Control */}
                                    <button
                                        onClick={toggleSpeaking}
                                        className={`speaker-btn ${isSpeaking ? 'active' : ''}`}
                                        title={isSpeaking ? "Stop reading question" : "Read question aloud"}
                                    >
                                        {isSpeaking ? (
                                            <>
                                                <VolumeX size={16} />
                                                <span>Stop</span>
                                            </>
                                        ) : (
                                            <>
                                                <Volume2 size={16} />
                                                <span>Read Aloud</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.6', color: '#f8fafc' }}>
                                    {question || 'Preparing your question...'}
                                </p>
                            </div>

                            {/* Answer Area */}
                            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="mic-btn-wrapper">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Your Answer</h3>
                                        {isRecording && (
                                            <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }}></span>
                                                Listening to you...
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={toggleRecording}
                                        style={{
                                            background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                            color: isRecording ? 'white' : '#94a3b8',
                                            border: isRecording ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            transition: 'all 0.3s',
                                            flexShrink: 0
                                        }}
                                    >
                                        {isRecording ? <Mic size={16} className="animate-pulse" /> : <MicOff size={16} />}
                                        {isRecording ? 'Listening (Click to Stop)' : 'Use Microphone'}
                                    </button>
                                </div>

                                <textarea
                                    className="glass-input"
                                    style={{ minHeight: '160px', resize: 'vertical', fontSize: '15px', lineHeight: '1.6' }}
                                    placeholder="Speak into your microphone or type your answer here..."
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                />

                                {/* Real-time speech interim transcription indicator */}
                                {interimText && (
                                    <div style={{ fontSize: '13px', color: '#818cf8', background: 'rgba(99, 102, 241, 0.08)', border: '1px dashed rgba(99, 102, 241, 0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                                        <span style={{ fontWeight: 600 }}>Transcribing: </span>"{interimText}"
                                    </div>
                                )}

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
