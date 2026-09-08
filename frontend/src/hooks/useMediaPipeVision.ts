import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { 
    LivePresenceMetrics, 
    SessionBehavioralSummary, 
    MediaPipeLandmarksData, 
    FacialExpressionType, 
    PostureStatusType 
} from '../types/mediaPipeVision';

interface UseMediaPipeVisionOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    enabled?: boolean;
}

export const useMediaPipeVision = ({ videoRef, enabled = true }: UseMediaPipeVisionOptions) => {
    const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
    const [modelError, setModelError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    
    // Live metrics updated smoothly
    const [liveMetrics, setLiveMetrics] = useState<LivePresenceMetrics>({
        isEyeContact: true,
        eyeContactScore: 90,
        gazeDirection: 'center',
        expression: 'Attentive & Focused',
        smileIntensity: 15,
        browTension: 5,
        isSpeaking: false,
        postureStatus: 'Upright & Balanced',
        postureScore: 95,
        shoulderTiltAngle: 0,
        headTiltAngle: 0,
        faceDetected: false,
        fps: 0
    });

    // Landmarks data for AR Canvas rendering
    const [landmarksData, setLandmarksData] = useState<MediaPipeLandmarksData>({});

    // Live coaching tip
    const [coachingTip, setCoachingTip] = useState<string>('Camera active: Maintain natural eye contact with the lens.');

    // Internal trackers
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animFrameIdRef = useRef<number | null>(null);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastFpsCalcTimeRef = useRef<number>(performance.now());
    const frameCountRef = useRef<number>(0);
    const sessionStartTimeRef = useRef<number>(Date.now());

    // Session Statistics Accumulator
    const sessionStatsRef = useRef({
        totalFrames: 0,
        eyeContactFrames: 0,
        uprightPostureFrames: 0,
        smileFrames: 0,
        attentiveFrames: 0,
        speakingFrames: 0,
        neutralFrames: 0,
        otherFrames: 0,
        sumEyeScore: 0,
        sumPostureScore: 0,
        sumSmileIntensity: 0
    });

    // Initialize MediaPipe WASM and Load Models
    useEffect(() => {
        let isMounted = true;

        const initMediaPipe = async () => {
            try {
                setIsModelLoading(true);
                setModelError(null);

                // Use official JSdelivr WASM binary distribution
                const visionWasm = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
                );

                if (!isMounted) return;

                // 1. Initialize Face Landmarker (Iris, Blendshapes, Transformation Matrix)
                let faceLandmarker: FaceLandmarker | null = null;
                try {
                    faceLandmarker = await FaceLandmarker.createFromOptions(visionWasm, {
                        baseOptions: {
                            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                            delegate: 'GPU'
                        },
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        outputFaceBlendshapes: true,
                        outputFacialTransformationMatrixes: true,
                        minFaceDetectionConfidence: 0.4,
                        minFacePresenceConfidence: 0.4,
                        minTrackingConfidence: 0.4
                    });
                } catch (gpuErr) {
                    console.warn('[MediaPipe] GPU delegate failed for FaceLandmarker, falling back to CPU:', gpuErr);
                    faceLandmarker = await FaceLandmarker.createFromOptions(visionWasm, {
                        baseOptions: {
                            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                            delegate: 'CPU'
                        },
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        outputFaceBlendshapes: true,
                        outputFacialTransformationMatrixes: true
                    });
                }

                if (!isMounted) return;
                faceLandmarkerRef.current = faceLandmarker;

                // 2. Initialize Pose Landmarker (Lite model for posture & shoulders)
                try {
                    const poseLandmarker = await PoseLandmarker.createFromOptions(visionWasm, {
                        baseOptions: {
                            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                            delegate: 'GPU'
                        },
                        runningMode: 'VIDEO',
                        numPoses: 1,
                        minPoseDetectionConfidence: 0.4,
                        minPosePresenceConfidence: 0.4,
                        minTrackingConfidence: 0.4
                    });
                    if (isMounted) {
                        poseLandmarkerRef.current = poseLandmarker;
                    }
                } catch (poseErr) {
                    console.warn('[MediaPipe] Pose Landmarker failed to load; using FaceLandmarker for head posture fallback:', poseErr);
                }

                if (isMounted) {
                    setIsInitialized(true);
                    setIsModelLoading(false);
                    sessionStartTimeRef.current = Date.now();
                }
            } catch (err: any) {
                console.error('[MediaPipe] Failed to initialize vision models:', err);
                if (isMounted) {
                    setModelError(err.message || 'Failed to initialize browser vision tracker');
                    setIsModelLoading(false);
                }
            }
        };

        if (enabled) {
            initMediaPipe();
        }

        return () => {
            isMounted = false;
            if (animFrameIdRef.current) {
                cancelAnimationFrame(animFrameIdRef.current);
            }
            if (faceLandmarkerRef.current) {
                try { faceLandmarkerRef.current.close(); } catch { /* noop */ }
            }
            if (poseLandmarkerRef.current) {
                try { poseLandmarkerRef.current.close(); } catch { /* noop */ }
            }
        };
    }, [enabled]);

    // Frame Processing Loop
    useEffect(() => {
        if (!isInitialized || !enabled) return;

        let active = true;
        let lastInferenceTime = 0;
        const TARGET_FRAME_INTERVAL = 50; // ~20 FPS inference for zero lag and low CPU usage

        const processFrame = () => {
            if (!active) return;

            const video = videoRef.current;
            const now = performance.now();

            if (video && video.readyState >= 2 && !video.paused && !video.ended) {
                // Throttle inference rate to keep browser silky smooth
                if (now - lastInferenceTime >= TARGET_FRAME_INTERVAL) {
                    const videoTime = video.currentTime;
                    if (videoTime !== lastVideoTimeRef.current) {
                        lastVideoTimeRef.current = videoTime;
                        lastInferenceTime = now;

                        // Calculate FPS
                        frameCountRef.current++;
                        if (now - lastFpsCalcTimeRef.current >= 1000) {
                            const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcTimeRef.current));
                            frameCountRef.current = 0;
                            lastFpsCalcTimeRef.current = now;
                            setLiveMetrics(prev => ({ ...prev, fps: currentFps }));
                        }

                        try {
                            const timestamp = Math.round(now);
                            
                            // 1. Run Face Landmarker
                            let faceResult = null;
                            if (faceLandmarkerRef.current) {
                                faceResult = faceLandmarkerRef.current.detectForVideo(video, timestamp);
                            }

                            // 2. Run Pose Landmarker (optional)
                            let poseResult = null;
                            if (poseLandmarkerRef.current) {
                                try {
                                    poseResult = poseLandmarkerRef.current.detectForVideo(video, timestamp);
                                } catch {
                                    // Non-fatal
                                }
                            }

                            // 3. Process biometrics & update state
                            if (faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                                const landmarks = faceResult.faceLandmarks[0];
                                const blendshapes = faceResult.faceBlendshapes?.[0]?.categories || [];
                                
                                // Blendshape map for quick lookup
                                const bsMap: Record<string, number> = {};
                                for (let i = 0; i < blendshapes.length; i++) {
                                    bsMap[blendshapes[i].categoryName] = blendshapes[i].score;
                                }

                                // Extract Key Landmarks
                                // Left eye: inner 133, outer 33, iris 468
                                // Right eye: inner 362, outer 263, iris 473
                                // Nose: 1, Chin: 152, Forehead: 10
                                const leftEyeOuter = landmarks[33];
                                const leftEyeInner = landmarks[133];
                                const leftIris = landmarks[468] || leftEyeInner;

                                const rightEyeOuter = landmarks[263];
                                const rightEyeInner = landmarks[362];
                                const rightIris = landmarks[473] || rightEyeInner;

                                const nose = landmarks[1];
                                const chin = landmarks[152];
                                const forehead = landmarks[10];

                                // ---- EYE CONTACT & GAZE CALCULATION ----
                                const eyeLookInL = bsMap['eyeLookInLeft'] || 0;
                                const eyeLookOutL = bsMap['eyeLookOutLeft'] || 0;
                                const eyeLookUpL = bsMap['eyeLookUpLeft'] || 0;
                                const eyeLookDownL = bsMap['eyeLookDownLeft'] || 0;

                                const eyeLookInR = bsMap['eyeLookInRight'] || 0;
                                const eyeLookOutR = bsMap['eyeLookOutRight'] || 0;
                                const eyeLookUpR = bsMap['eyeLookUpRight'] || 0;
                                const eyeLookDownR = bsMap['eyeLookDownRight'] || 0;

                                const maxLookLeft = Math.max(eyeLookOutL, eyeLookInR);
                                const maxLookRight = Math.max(eyeLookInL, eyeLookOutR);
                                const maxLookUp = Math.max(eyeLookUpL, eyeLookUpR);
                                const maxLookDown = Math.max(eyeLookDownL, eyeLookDownR);

                                // Geometric iris position relative to eye width
                                const leftEyeWidth = Math.max(0.01, Math.abs(leftEyeInner.x - leftEyeOuter.x));
                                const leftIrisOffset = (leftIris.x - leftEyeOuter.x) / leftEyeWidth; // ~0.45 - 0.55 is centered

                                const rightEyeWidth = Math.max(0.01, Math.abs(rightEyeOuter.x - rightEyeInner.x));
                                const rightIrisOffset = (rightIris.x - rightEyeInner.x) / rightEyeWidth; // ~0.45 - 0.55 is centered

                                // Head yaw (rotation left/right)
                                const cheekL = landmarks[234];
                                const cheekR = landmarks[454];
                                const distL = Math.abs(nose.x - cheekL.x);
                                const distR = Math.abs(cheekR.x - nose.x);
                                const headYawRatio = (distL - distR) / Math.max(0.01, distL + distR); // >0 turns left, <0 turns right

                                // Head pitch (nodding / slouching head)
                                const upperFace = Math.abs(nose.y - forehead.y);
                                const lowerFace = Math.abs(chin.y - nose.y);
                                const headPitchRatio = (upperFace - lowerFace) / Math.max(0.01, upperFace + lowerFace);

                                // Head roll (tilt) in degrees
                                const dxEyes = rightEyeOuter.x - leftEyeOuter.x;
                                const dyEyes = rightEyeOuter.y - leftEyeOuter.y;
                                const headTiltAngle = Math.round(Math.atan2(dyEyes, dxEyes) * (180 / Math.PI));

                                // Determine Gaze Direction
                                let gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' = 'center';
                                if (maxLookLeft > 0.42 || headYawRatio > 0.35 || leftIrisOffset < 0.3) {
                                    gazeDirection = 'left';
                                } else if (maxLookRight > 0.42 || headYawRatio < -0.35 || rightIrisOffset > 0.7) {
                                    gazeDirection = 'right';
                                } else if (maxLookUp > 0.42 || headPitchRatio < -0.32) {
                                    gazeDirection = 'up';
                                } else if (maxLookDown > 0.45 || headPitchRatio > 0.35) {
                                    gazeDirection = 'down';
                                }

                                const isEyeContact = gazeDirection === 'center' 
                                    && maxLookLeft < 0.38 
                                    && maxLookRight < 0.38 
                                    && maxLookUp < 0.38 
                                    && maxLookDown < 0.42 
                                    && Math.abs(headYawRatio) < 0.32;

                                const eyeContactScore = isEyeContact 
                                    ? Math.round(90 + (1 - Math.max(maxLookLeft, maxLookRight, maxLookUp, maxLookDown)) * 10)
                                    : Math.max(20, Math.round(75 - (Math.max(maxLookLeft, maxLookRight, maxLookUp, maxLookDown) * 60)));

                                // ---- FACIAL EXPRESSIONS ----
                                const smileL = bsMap['mouthSmileLeft'] || 0;
                                const smileR = bsMap['mouthSmileRight'] || 0;
                                const avgSmile = (smileL + smileR) / 2;
                                const smileIntensity = Math.round(avgSmile * 100);

                                const browDownL = bsMap['browDownLeft'] || 0;
                                const browDownR = bsMap['browDownRight'] || 0;
                                const browInnerUp = bsMap['browInnerUp'] || 0;
                                const browTension = Math.round(((browDownL + browDownR) / 2 + browInnerUp * 0.5) * 100);

                                const jawOpen = bsMap['jawOpen'] || 0;
                                const isSpeaking = jawOpen > 0.18;

                                let expression: FacialExpressionType = 'Neutral & Composed';
                                if (avgSmile > 0.35) {
                                    expression = 'Smiling & Warm';
                                } else if (isSpeaking) {
                                    expression = 'Speaking';
                                } else if (browTension > 35 || browInnerUp > 0.35) {
                                    expression = 'Puzzled / Thinking';
                                } else if (isEyeContact && (avgSmile > 0.08 || Math.abs(headYawRatio) < 0.15)) {
                                    expression = 'Attentive & Focused';
                                }

                                // ---- POSTURE TRACKING ----
                                let postureStatus: PostureStatusType = 'Upright & Balanced';
                                let shoulderTilt = 0;
                                let postureScore = 95;

                                const poseLandmarks = poseResult?.landmarks?.[0];
                                if (poseLandmarks && poseLandmarks.length > 12) {
                                    const leftShoulder = poseLandmarks[11];
                                    const rightShoulder = poseLandmarks[12];
                                    if (leftShoulder && rightShoulder && (leftShoulder.visibility || 1) > 0.3 && (rightShoulder.visibility || 1) > 0.3) {
                                        const dxS = rightShoulder.x - leftShoulder.x;
                                        const dyS = rightShoulder.y - leftShoulder.y;
                                        shoulderTilt = Math.round(Math.atan2(dyS, dxS) * (180 / Math.PI));
                                        
                                        // Detect shoulder slouching / neck compression
                                        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
                                        const headToShoulderDist = shoulderMidY - chin.y;
                                        
                                        if (Math.abs(shoulderTilt) > 8) {
                                            postureStatus = 'Shoulders Tilted';
                                            postureScore = Math.max(50, 85 - Math.abs(shoulderTilt) * 2);
                                        } else if (headToShoulderDist < 0.08 || headPitchRatio > 0.38) {
                                            postureStatus = 'Slouching Detected';
                                            postureScore = 65;
                                        } else if (Math.abs(headTiltAngle) > 12) {
                                            postureStatus = 'Leaning Off-Center';
                                            postureScore = 75;
                                        }
                                    }
                                } else {
                                    // Fallback posture using head orientation
                                    if (Math.abs(headTiltAngle) > 14) {
                                        postureStatus = 'Leaning Off-Center';
                                        postureScore = 75;
                                    } else if (headPitchRatio > 0.38) {
                                        postureStatus = 'Slouching Detected';
                                        postureScore = 65;
                                    }
                                }

                                // Accumulate Session Telemetry
                                const stats = sessionStatsRef.current;
                                stats.totalFrames++;
                                if (isEyeContact) stats.eyeContactFrames++;
                                if (postureStatus === 'Upright & Balanced') stats.uprightPostureFrames++;
                                stats.sumEyeScore += eyeContactScore;
                                stats.sumPostureScore += postureScore;
                                stats.sumSmileIntensity += smileIntensity;

                                if (expression === 'Smiling & Warm') stats.smileFrames++;
                                else if (expression === 'Attentive & Focused') stats.attentiveFrames++;
                                else if (expression === 'Speaking') stats.speakingFrames++;
                                else if (expression === 'Neutral & Composed') stats.neutralFrames++;
                                else stats.otherFrames++;

                                // Dynamic subtle coaching tip
                                if (!isEyeContact && stats.totalFrames % 40 === 0) {
                                    if (gazeDirection === 'down') {
                                        setCoachingTip('Looking down: Glance up toward the camera lens to connect.');
                                    } else if (gazeDirection === 'left' || gazeDirection === 'right') {
                                        setCoachingTip('Eye contact shifted: Center your focus on the interviewer.');
                                    }
                                } else if (postureStatus === 'Slouching Detected' && stats.totalFrames % 40 === 0) {
                                    setCoachingTip('Posture check: Roll your shoulders back and sit tall.');
                                } else if (postureStatus === 'Shoulders Tilted' && stats.totalFrames % 40 === 0) {
                                    setCoachingTip('Level your shoulders to present balanced confidence.');
                                } else if (isEyeContact && postureStatus === 'Upright & Balanced' && stats.totalFrames % 80 === 0) {
                                    setCoachingTip('Excellent presence! Upright posture and strong eye contact maintained.');
                                }

                                setLiveMetrics({
                                    isEyeContact,
                                    eyeContactScore,
                                    gazeDirection,
                                    expression,
                                    smileIntensity,
                                    browTension,
                                    isSpeaking,
                                    postureStatus,
                                    postureScore,
                                    shoulderTiltAngle: shoulderTilt,
                                    headTiltAngle,
                                    faceDetected: true,
                                    fps: liveMetrics.fps
                                });

                                setLandmarksData({
                                    faceLandmarks: landmarks,
                                    poseLandmarks: poseLandmarks
                                });
                            } else {
                                setLiveMetrics(prev => ({
                                    ...prev,
                                    faceDetected: false
                                }));
                                setLandmarksData({});
                            }
                        } catch (detectErr) {
                            console.warn('[MediaPipe detection warning]:', detectErr);
                        }
                    }
                }
            }

            if (active) {
                animFrameIdRef.current = requestAnimationFrame(processFrame);
            }
        };

        animFrameIdRef.current = requestAnimationFrame(processFrame);

        return () => {
            active = false;
            if (animFrameIdRef.current) {
                cancelAnimationFrame(animFrameIdRef.current);
            }
        };
    }, [isInitialized, enabled]);

    // Finalize session metrics and save to localStorage
    const finalizeSessionSummary = useCallback((): SessionBehavioralSummary => {
        const stats = sessionStatsRef.current;
        const total = Math.max(1, stats.totalFrames);
        const durationSec = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);

        const eyeContactPct = Math.round((stats.eyeContactFrames / total) * 100);
        const postureStabilityPct = Math.round((stats.uprightPostureFrames / total) * 100);
        const engagementPct = Math.min(100, Math.round(((stats.smileFrames + stats.attentiveFrames + stats.speakingFrames) / total) * 100));

        const overallPresenceScore = Math.round((eyeContactPct * 0.4) + (postureStabilityPct * 0.35) + (engagementPct * 0.25));

        const strengths: string[] = [];
        const areasForImprovement: string[] = [];
        const coachingAdvice: string[] = [];

        if (eyeContactPct >= 75) {
            strengths.push(`Maintained direct eye contact for ${eyeContactPct}% of the session, signaling strong self-assurance.`);
        } else {
            areasForImprovement.push(`Camera gaze was maintained ${eyeContactPct}% of the time; aim for at least 70% to connect more persuasively.`);
            coachingAdvice.push('Position your camera at eye level so looking at the interviewer is completely natural.');
        }

        if (postureStabilityPct >= 80) {
            strengths.push(`Demonstrated composed, upright posture for ${postureStabilityPct}% of the interview.`);
        } else {
            areasForImprovement.push(`Slouching or uneven posture was noted for ${100 - postureStabilityPct}% of the interview.`);
            coachingAdvice.push('Keep both feet flat on the floor and gently pull your shoulders down and back.');
        }

        if (stats.smileFrames / total >= 0.15) {
            strengths.push('Exhibited warm and engaging facial expressions when introducing ideas.');
        } else {
            coachingAdvice.push('Incorporate occasional warm smiles to build rapport with the hiring panel.');
        }

        if (strengths.length === 0) {
            strengths.push('Consistently present and framed on camera throughout the mock evaluation.');
        }

        const summary: SessionBehavioralSummary = {
            totalFramesAnalyzed: total,
            sessionDurationSeconds: durationSec,
            overallPresenceScore,
            eyeContactPercentage: eyeContactPct,
            postureStabilityPercentage: postureStabilityPct,
            engagementPercentage: engagementPct,
            expressionDistribution: {
                smilingTimePct: Math.round((stats.smileFrames / total) * 100),
                attentiveTimePct: Math.round((stats.attentiveFrames / total) * 100),
                speakingTimePct: Math.round((stats.speakingFrames / total) * 100),
                neutralTimePct: Math.round((stats.neutralFrames / total) * 100),
                otherTimePct: Math.round((stats.otherFrames / total) * 100)
            },
            strengths,
            areasForImprovement,
            coachingAdvice,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem('interview_behavioral_metrics', JSON.stringify(summary));
        } catch (e) {
            console.warn('[MediaPipe] Could not save behavioral metrics to localStorage:', e);
        }

        return summary;
    }, []);

    return {
        isModelLoading,
        modelError,
        isInitialized,
        liveMetrics,
        landmarksData,
        coachingTip,
        finalizeSessionSummary
    };
};
