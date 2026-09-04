import React from 'react';

interface LoaderOverlayProps {
    isVisible: boolean;
    text?: string;
    subText?: string;
}

const LoaderOverlay: React.FC<LoaderOverlayProps> = ({ isVisible, text = 'Processing...', subText = 'Please wait.' }) => {
    if (!isVisible) return null;

    return (
        <div className="loader-overlay">
            <style>{`
                .loader-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(5, 5, 16, 0.85);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 24px;
                    overflow: hidden;
                }

                /* ── Ambient glow ── */
                .loader-glow {
                    position: absolute;
                    width: 320px;
                    height: 320px;
                    border-radius: 50%;
                    background: radial-gradient(
                        circle,
                        rgba(99, 102, 241, 0.25) 0%,
                        rgba(139, 92, 246, 0.1) 40%,
                        transparent 70%
                    );
                    filter: blur(60px);
                    animation: loaderPulseGlow 3s ease-in-out infinite;
                    pointer-events: none;
                }

                /* ── Spinner container ── */
                .loader-spinner-wrapper {
                    position: relative;
                    width: 120px;
                    height: 120px;
                    margin-bottom: 32px;
                }

                /* ── Core orb ── */
                .loader-orb {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 44px;
                    height: 44px;
                    transform: translate(-50%, -50%);
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa);
                    box-shadow:
                        0 0 30px rgba(99, 102, 241, 0.5),
                        0 0 60px rgba(139, 92, 246, 0.25),
                        inset 0 -6px 12px rgba(0, 0, 0, 0.3),
                        inset 0 6px 12px rgba(255, 255, 255, 0.15);
                    animation: loaderOrbPulse 2s ease-in-out infinite;
                }

                .loader-orb::after {
                    content: '';
                    position: absolute;
                    top: 6px;
                    left: 10px;
                    width: 16px;
                    height: 10px;
                    border-radius: 50%;
                    background: linear-gradient(
                        180deg,
                        rgba(255, 255, 255, 0.4) 0%,
                        transparent 100%
                    );
                    filter: blur(2px);
                }

                /* ── Spinning rings ── */
                .loader-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    border-radius: 50%;
                    border: 2px solid transparent;
                }

                .loader-ring-1 {
                    width: 72px;
                    height: 72px;
                    margin: -36px 0 0 -36px;
                    border-top-color: rgba(129, 140, 248, 0.8);
                    border-right-color: rgba(129, 140, 248, 0.2);
                    animation: loaderSpin 1.2s linear infinite;
                }

                .loader-ring-2 {
                    width: 92px;
                    height: 92px;
                    margin: -46px 0 0 -46px;
                    border-top-color: rgba(167, 139, 250, 0.5);
                    border-left-color: rgba(167, 139, 250, 0.15);
                    animation: loaderSpin 1.8s linear infinite reverse;
                }

                .loader-ring-3 {
                    width: 112px;
                    height: 112px;
                    margin: -56px 0 0 -56px;
                    border-top-color: rgba(99, 102, 241, 0.3);
                    border-bottom-color: rgba(99, 102, 241, 0.08);
                    animation: loaderSpin 2.8s linear infinite;
                }

                /* ── Orbiting particles ── */
                .loader-particle {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 5px;
                    height: 5px;
                    margin: -2.5px 0 0 -2.5px;
                    border-radius: 50%;
                    background: #a5b4fc;
                    box-shadow: 0 0 8px rgba(165, 180, 252, 0.6);
                }

                .loader-particle-1 {
                    animation: loaderOrbit1 2.4s linear infinite;
                }
                .loader-particle-2 {
                    animation: loaderOrbit2 3.2s linear infinite;
                    width: 4px;
                    height: 4px;
                    background: #818cf8;
                    box-shadow: 0 0 6px rgba(129, 140, 248, 0.5);
                }
                .loader-particle-3 {
                    animation: loaderOrbit3 4s linear infinite;
                    width: 3px;
                    height: 3px;
                    background: #c4b5fd;
                    box-shadow: 0 0 6px rgba(196, 181, 253, 0.5);
                }

                /* ── Text ── */
                .loader-text-wrapper {
                    text-align: center;
                    position: relative;
                    z-index: 1;
                }

                .loader-title {
                    margin: 0;
                    font-size: 22px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #fff, #a5b4fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: loaderTextFade 2s ease-in-out infinite;
                }

                .loader-sub {
                    color: rgba(255, 255, 255, 0.5);
                    margin: 10px 0 0;
                    font-size: 14px;
                    max-width: 340px;
                    line-height: 1.5;
                }

                /* ── Progress dots ── */
                .loader-dots {
                    display: flex;
                    gap: 6px;
                    margin-top: 24px;
                }

                .loader-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: rgba(129, 140, 248, 0.4);
                    animation: loaderDotBounce 1.4s ease-in-out infinite;
                }

                .loader-dot:nth-child(2) { animation-delay: 0.2s; }
                .loader-dot:nth-child(3) { animation-delay: 0.4s; }

                /* ── Responsive ── */
                @media (max-width: 480px) {
                    .loader-spinner-wrapper {
                        width: 90px;
                        height: 90px;
                        margin-bottom: 24px;
                    }
                    .loader-orb {
                        width: 32px;
                        height: 32px;
                    }
                    .loader-ring-1 { width: 54px; height: 54px; margin: -27px 0 0 -27px; }
                    .loader-ring-2 { width: 70px; height: 70px; margin: -35px 0 0 -35px; }
                    .loader-ring-3 { width: 86px; height: 86px; margin: -43px 0 0 -43px; }
                    .loader-title { font-size: 18px; }
                    .loader-sub { font-size: 13px; max-width: 260px; }
                    .loader-glow { width: 200px; height: 200px; }
                }

                /* ── Keyframes ── */
                @keyframes loaderSpin {
                    to { transform: rotate(360deg); }
                }

                @keyframes loaderOrbPulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(139,92,246,0.25), inset 0 -6px 12px rgba(0,0,0,0.3), inset 0 6px 12px rgba(255,255,255,0.15); }
                    50% { transform: translate(-50%, -50%) scale(1.12); box-shadow: 0 0 40px rgba(99,102,241,0.7), 0 0 80px rgba(139,92,246,0.35), inset 0 -6px 12px rgba(0,0,0,0.3), inset 0 6px 12px rgba(255,255,255,0.15); }
                }

                @keyframes loaderPulseGlow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.15); }
                }

                @keyframes loaderTextFade {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                @keyframes loaderDotBounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1.2); opacity: 1; background: #818cf8; }
                }

                @keyframes loaderOrbit1 {
                    from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
                    to   { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
                }

                @keyframes loaderOrbit2 {
                    from { transform: rotate(120deg) translateX(52px) rotate(-120deg); }
                    to   { transform: rotate(480deg) translateX(52px) rotate(-480deg); }
                }

                @keyframes loaderOrbit3 {
                    from { transform: rotate(240deg) translateX(60px) rotate(-240deg); }
                    to   { transform: rotate(600deg) translateX(60px) rotate(-600deg); }
                }
            `}</style>

            {/* Ambient glow */}
            <div className="loader-glow" />

            {/* Spinner */}
            <div className="loader-spinner-wrapper">
                <div className="loader-ring loader-ring-3" />
                <div className="loader-ring loader-ring-2" />
                <div className="loader-ring loader-ring-1" />
                <div className="loader-orb" />
                <div className="loader-particle loader-particle-1" />
                <div className="loader-particle loader-particle-2" />
                <div className="loader-particle loader-particle-3" />
            </div>

            {/* Text */}
            <div className="loader-text-wrapper">
                <h2 className="loader-title">{text}</h2>
                {subText && <p className="loader-sub">{subText}</p>}
                <div className="loader-dots">
                    <div className="loader-dot" />
                    <div className="loader-dot" />
                    <div className="loader-dot" />
                </div>
            </div>
        </div>
    );
};

export default LoaderOverlay;
