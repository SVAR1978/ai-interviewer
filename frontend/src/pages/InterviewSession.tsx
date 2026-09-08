import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Loader2, StopCircle, Camera, Volume2, VolumeX, Sparkles, Wifi, WifiOff, Radio } from 'lucide-react';
import LoaderOverlay from '../components/LoaderOverlay';
import WebcamPresenceHUD from '../components/WebcamPresenceHUD';
import { useInterviewSocket } from '../hooks/useInterviewSocket';
import { useProAudioPlayer } from '../hooks/useProAudioPlayer';
import { useProAudioRecorder } from '../hooks/useProAudioRecorder';
import { useMediaPipeVision } from '../hooks/useMediaPipeVision';

const InterviewSession: React.FC = () => {
    const [question, setQuestion] = useState<string>('');
    const [answer, setAnswer] = useState<string>('');
    const [interimText, setInterimText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [questionNumber, setQuestionNumber] = useState<number>(1);

    const username = localStorage.getItem('username') || '';
    const domain = localStorage.getItem('domain') || '';
    const jobDescriptionId = localStorage.getItem('jobDescriptionId') || undefined;

    const videoRef = useRef<HTMLVideoElement>(null);
    const questionRef = useRef<string>('');
    const navigate = useNavigate();

    // Keep current question in ref for audio callbacks
    useEffect(() => {
        questionRef.current = question;
    }, [question]);

    // Pro Audio: Hyper-realistic ElevenLabs playback & instant interruption
    const proAudioPlayer = useProAudioPlayer();

    // Socket.io Real-Time Interview Loop Hook
    const {
        socket,
        isConnected,
        isStreaming,
        socketError,
        submitAnswer: socketSubmitAnswer,
        requestTTS,
        interrupt,
    } = useInterviewSocket({
        username,
        domain,
        jobDescriptionId,
        onSyncState: (data) => {
            if (data.question) {
                setQuestion(data.question);
                setQuestionNumber(data.qno);
            }
        },
        onStreamStart: (data) => {
            setIsLoading(false);
            setQuestion('');
            setQuestionNumber(data.qno);
        },
        onChunk: (data) => {
            setQuestion(data.currentText);
        },
        onStreamEnd: (data) => {
            setQuestion(data.question);
            setQuestionNumber(data.qno);
            setIsLoading(false);
            // Request Azure AI Speech realistic voice audio for the question
            requestTTS(data.question);
        },
        onTTSResponse: (data) => {
            // Play realistic Azure AI Speech voice audio (Blob/MP3) or fallback
            proAudioPlayer.play({
                audioBase64: data.audioBase64,
                fallbackText: questionRef.current,
                provider: data.provider as any,
                onEnd: () => {
                    // Automatically activate mic for candidate's answer after question finishes
                    proAudioRecorder.startRecording();
                }
            });
        },
        onError: (err) => {
            setIsLoading(false);
            console.warn('[InterviewSession] Socket notice:', err);
        }
    });

    // Pro Audio: Deepgram Live STT Audio Stream Recorder
    const proAudioRecorder = useProAudioRecorder({
        socket,
        onTranscriptChunk: ({ transcript, isFinal }) => {
            // Natural interruption: if AI is speaking, cut audio immediately
            if (proAudioPlayer.isPlaying) {
                proAudioPlayer.stop();
                interrupt('candidate_started_speaking');
            }

            if (isFinal) {
                setAnswer(prev => {
                    const trimmed = prev.trim();
                    const trimmedChunk = transcript.trim();
                    return trimmed ? `${trimmed} ${trimmedChunk}` : trimmedChunk;
                });
                setInterimText('');
            } else {
                setInterimText(transcript);
            }
        },
        onError: (err) => {
            console.warn('[ProAudioRecorder notice]:', err);
        }
    });

    // Toggle speaker on/off
    const toggleSpeaking = () => {
        if (proAudioPlayer.isPlaying) {
            proAudioPlayer.stop();
            interrupt('user_paused_ai_audio');
        } else {
            requestTTS(question);
            proAudioPlayer.play({ fallbackText: question });
        }
    };

    // Toggle microphone
    const toggleRecording = () => {
        if (proAudioRecorder.isRecording) {
            proAudioRecorder.stopRecording();
        } else {
            // If AI is currently reading the question, stop speech first & naturally interrupt
            if (proAudioPlayer.isPlaying) {
                proAudioPlayer.stop();
                interrupt('candidate_interrupted_speech');
            }
            proAudioRecorder.startRecording();
        }
    };

    // Google MediaPipe WebAssembly Vision Tracker for Eye Contact, Expressions & Posture
    const {
        isModelLoading,
        modelError,
        liveMetrics,
        landmarksData,
        coachingTip,
        finalizeSessionSummary
    } = useMediaPipeVision({ videoRef });

    useEffect(() => {
        const storedQuestion = localStorage.getItem('firstQuestion');
        if (storedQuestion) {
            setQuestion(storedQuestion);
            // Request hyper-realistic voice audio for initial question
            setTimeout(() => {
                requestTTS(storedQuestion);
                proAudioPlayer.play({ fallbackText: storedQuestion });
            }, 600);
        } else {
            navigate('/interview');
        }

        // Initialize camera
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };

        startCamera();

        return () => {
            // Cleanup camera stream
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            proAudioPlayer.stop();
            proAudioRecorder.stopRecording();
        };
    }, [navigate]);

    // Fallback REST handler if WebSocket connection is temporarily unavailable
    const fallbackRestSubmit = async (fullAnswer: string) => {
        try {
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

            const res = await fetch('http://localhost:3000/api/interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'username': username || ''
                },
                body: JSON.stringify({ domain, jobDescriptionId })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Your answer was saved, but we could not load the next question. Please try clicking Submit again.');
                return;
            }

            if (data.question) {
                setQuestion(data.question);
                setQuestionNumber(prev => prev + 1);
                requestTTS(data.question);
                proAudioPlayer.play({ fallbackText: data.question });
            } else {
                alert("Interview sequence error.");
            }
        } catch (err: any) {
            console.error('[REST Fallback Error]:', err);
            alert(err.message || 'Failed to submit answer.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitAnswer = async () => {
        const fullAnswer = answer.trim();
        if (!fullAnswer) return alert('Please provide an answer.');

        // Stop recording & speaking before submitting
        proAudioRecorder.stopRecording();
        proAudioPlayer.stop();
        interrupt('submitting_answer');

        setAnswer('');
        setInterimText('');

        if (isConnected) {
            try {
                setIsLoading(true);
                socketSubmitAnswer(fullAnswer);
            } catch (err) {
                console.warn('[Socket] Submit failed, falling back to REST:', err);
                await fallbackRestSubmit(fullAnswer);
            }
        } else {
            setIsLoading(true);
            await fallbackRestSubmit(fullAnswer);
        }
    };

    const handleEndInterview = async () => {
        proAudioPlayer.stop();
        proAudioRecorder.stopRecording();
        interrupt('ending_interview');
        if (window.confirm("Are you sure you want to end the interview and generate your score?")) {
            try {
                finalizeSessionSummary();
            } catch (err) {
                console.warn('Failed to save session behavioral summary:', err);
            }
            navigate('/score/detail');
        }
    };

    return (
        <>
            <LoaderOverlay
                isVisible={isLoading && !isStreaming}
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

                    {/* Header with Live Connection Status */}
                    <div className="interview-header">
                        <div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Mock Interview Session</h2>
                            <p style={{ margin: 0, color: '#818cf8', fontSize: '14px', marginTop: '4px' }}>
                                Question {questionNumber} • {domain || localStorage.getItem('domain')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {/* Pro Audio Indicator */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: '20px',
                                padding: '4px 12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#c7d2fe'
                            }}>
                                <Radio size={13} className={proAudioPlayer.isPlaying ? "animate-pulse" : ""} />
                                <span>Pro Audio Active</span>
                            </div>

                            {/* Live WebSocket Indicator */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: isConnected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                border: isConnected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '20px',
                                padding: '4px 12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: isConnected ? '#4ade80' : '#f87171'
                            }}
                                title={socketError ? `Socket note: ${socketError}` : (isConnected ? 'Real-time WebSocket connection active' : 'Connecting to real-time server...')}
                            >
                                {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                                <span>{isConnected ? 'Live WebSocket' : (socketError ? 'Reconnecting...' : 'Connecting...')}</span>
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
                    </div>

                    {/* Two-column grid */}
                    <div className="interview-grid">
                        {/* Main Content Area */}
                        <div className="interview-main">

                            {/* Question Card with Streaming Badge & Speaker Button */}
                            <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #818cf8' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        AI Interviewer
                                        {isStreaming && (
                                            <span style={{ fontSize: '11px', textTransform: 'none', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', border: '1px solid rgba(129, 140, 248, 0.4)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                <Sparkles size={12} className="animate-spin" />
                                                Streaming question in real-time...
                                            </span>
                                        )}
                                        {proAudioPlayer.isPlaying && !isStreaming && (
                                            <span style={{ fontSize: '11px', textTransform: 'none', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                <div className="sound-wave">
                                                    <span></span>
                                                    <span></span>
                                                    <span></span>
                                                </div>
                                                {proAudioPlayer.currentProvider === 'azure' ? 'Azure Neural Voice...' : 'Reading question...'}
                                            </span>
                                        )}
                                    </h3>

                                    {/* Functional Speaker Control */}
                                    <button
                                        onClick={toggleSpeaking}
                                        className={`speaker-btn ${proAudioPlayer.isPlaying ? 'active' : ''}`}
                                        title={proAudioPlayer.isPlaying ? "Stop audio playback" : "Listen to question"}
                                    >
                                        {proAudioPlayer.isPlaying ? (
                                            <>
                                                <VolumeX size={16} />
                                                <span>Stop</span>
                                            </>
                                        ) : (
                                            <>
                                                <Volume2 size={16} />
                                                <span>Listen</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.6', color: '#f8fafc', whiteSpace: 'pre-wrap' }}>
                                    {question || (isStreaming ? 'AI is formulating question...' : 'Preparing your question...')}
                                </p>
                            </div>

                            {/* Answer Area */}
                            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="mic-btn-wrapper">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Your Answer</h3>
                                        {proAudioRecorder.isRecording && (
                                            <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }}></span>
                                                {proAudioRecorder.sttProvider === 'deepgram' ? 'Deepgram Nova-2 (Live)' : 'Microphone Live'}
                                                {proAudioRecorder.audioLevel > 5 && (
                                                    <span style={{ display: 'inline-block', width: `${Math.min(24, Math.max(6, proAudioRecorder.audioLevel / 3))}px`, height: '4px', background: '#ef4444', borderRadius: '2px', marginLeft: '4px' }}></span>
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={toggleRecording}
                                        style={{
                                            background: proAudioRecorder.isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                            color: proAudioRecorder.isRecording ? 'white' : '#94a3b8',
                                            border: proAudioRecorder.isRecording ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
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
                                        {proAudioRecorder.isRecording ? <Mic size={16} className="animate-pulse" /> : <MicOff size={16} />}
                                        {proAudioRecorder.isRecording ? 'Listening (Click to Stop)' : 'Use Microphone'}
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

                        {/* Sidebar (MediaPipe Camera & Presence Tracker) */}
                        <div className="interview-sidebar">
                            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', width: '100%', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <Camera size={16} style={{ color: '#818cf8' }} />
                                        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>AI Presence Tracker</span>
                                    </div>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        color: '#818cf8',
                                        background: 'rgba(99, 102, 241, 0.12)',
                                        border: '1px solid rgba(99, 102, 241, 0.25)',
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                        letterSpacing: '0.5px'
                                    }}>
                                        MEDIAPIPE WASM
                                    </span>
                                </div>

                                <WebcamPresenceHUD
                                    videoRef={videoRef}
                                    liveMetrics={liveMetrics}
                                    landmarksData={landmarksData}
                                    isModelLoading={isModelLoading}
                                    modelError={modelError}
                                    coachingTip={coachingTip}
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default InterviewSession;
