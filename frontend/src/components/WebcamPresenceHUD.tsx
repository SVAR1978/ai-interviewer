import React, { useState } from 'react';
import {
    Eye,
    Smile,
    Activity,
    Sparkles,
    ShieldCheck,
    AlertTriangle,
    Volume2,
    VolumeX
} from 'lucide-react';
import type { LivePresenceMetrics, MediaPipeLandmarksData } from '../types/mediaPipeVision';

interface WebcamPresenceHUDProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    liveMetrics: LivePresenceMetrics;
    landmarksData?: MediaPipeLandmarksData;
    isModelLoading: boolean;
    modelError: string | null;
    coachingTip: string;
}

const WebcamPresenceHUD: React.FC<WebcamPresenceHUDProps> = ({
    videoRef,
    liveMetrics,
    isModelLoading,
    modelError,
    coachingTip
}) => {
    const [showTips, setShowTips] = useState<boolean>(true);

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Clean Camera Frame Container - 100% Unobstructed Video */}
            <div
                className="camera-video-container"
                style={{
                    width: '100%',
                    aspectRatio: '3/4',
                    background: '#090d16',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
            >
                {/* Real-time Video Stream (Clean mirror feed - Full face visible without overlays) */}
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

            {/* Real-time Presence Telemetry & Metrics (Placed neatly below the video) */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {/* Telemetry Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#94a3b8'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={14} style={{ color: '#818cf8' }} />
                        Real-time Presence Telemetry
                    </span>
                    <button
                        onClick={() => setShowTips(!showTips)}
                        title={showTips ? 'Mute Live Tips' : 'Enable Live Tips'}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: showTips ? '#818cf8' : '#64748b',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.2s'
                        }}
                    >
                        {showTips ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </button>
                </div>

                {/* Live Status Indicators (Eye Contact, Posture, Expression) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {/* Eye Contact Status */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: liveMetrics.isEyeContact
                            ? '1px solid rgba(56, 189, 248, 0.35)'
                            : '1px solid rgba(251, 191, 36, 0.35)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                    }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={11} style={{ color: liveMetrics.isEyeContact ? '#38bdf8' : '#fbbf24' }} />
                            Eye Contact
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: liveMetrics.isEyeContact ? '#38bdf8' : '#fbbf24',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {liveMetrics.isEyeContact ? 'Direct' : 'Away'}
                        </span>
                    </div>

                    {/* Posture Status */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: liveMetrics.postureStatus === 'Upright & Balanced'
                            ? '1px solid rgba(74, 222, 128, 0.35)'
                            : '1px solid rgba(248, 113, 113, 0.35)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                    }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {liveMetrics.postureStatus === 'Upright & Balanced' ? (
                                <ShieldCheck size={11} style={{ color: '#4ade80' }} />
                            ) : (
                                <AlertTriangle size={11} style={{ color: '#f87171' }} />
                            )}
                            Posture
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: liveMetrics.postureStatus === 'Upright & Balanced' ? '#4ade80' : '#f87171',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {liveMetrics.postureStatus === 'Upright & Balanced' ? 'Upright' : 'Slouching'}
                        </span>
                    </div>

                    {/* Expression Status */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(192, 132, 252, 0.3)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                    }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Smile size={11} style={{ color: '#c084fc' }} />
                            Expression
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#e9d5ff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {liveMetrics.expression === 'Smiling & Warm'
                                ? 'Smiling'
                                : liveMetrics.expression === 'Speaking'
                                ? 'Speaking'
                                : 'Focused'}
                        </span>
                    </div>
                </div>

                {/* Gauges Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Eye Contact Meter */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: '#cbd5e1' }}>Eye Contact Focus</span>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{liveMetrics.eyeContactScore}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${liveMetrics.eyeContactScore}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>

                    {/* Posture Stability Meter */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: '#cbd5e1' }}>Posture & Poise</span>
                            <span style={{ color: '#4ade80', fontWeight: 600 }}>{liveMetrics.postureScore}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${liveMetrics.postureScore}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>

                    {/* Warmth & Engagement Meter */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: '#cbd5e1' }}>Expression / Warmth</span>
                            <span style={{ color: '#c084fc', fontWeight: 600 }}>{liveMetrics.smileIntensity}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.max(10, liveMetrics.smileIntensity)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #9333ea, #c084fc)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Model Loading Status Notice if needed */}
                {isModelLoading && (
                    <div style={{ fontSize: '11px', color: '#fbbf24', textAlign: 'center' }}>
                        MediaPipe vision tracker initializing...
                    </div>
                )}

                {/* Model Error Notice (displayed neatly below, never covering the face) */}
                {modelError && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '11px'
                    }}>
                        Vision tracker notice: {modelError}
                    </div>
                )}

                {/* Live Non-verbal Coaching Toast */}
                {showTips && coachingTip && (
                    <div style={{
                        marginTop: '4px',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '11px',
                        color: '#c7d2fe',
                        lineHeight: '1.4'
                    }}>
                        <Sparkles size={13} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
                        <span>{coachingTip}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebcamPresenceHUD;
