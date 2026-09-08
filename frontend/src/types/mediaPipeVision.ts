export type FacialExpressionType = 
    | 'Smiling & Warm'
    | 'Attentive & Focused'
    | 'Speaking'
    | 'Puzzled / Thinking'
    | 'Neutral & Composed';

export type PostureStatusType = 
    | 'Upright & Balanced'
    | 'Slouching Detected'
    | 'Shoulders Tilted'
    | 'Leaning Off-Center';

export interface LivePresenceMetrics {
    // Eye contact
    isEyeContact: boolean;
    eyeContactScore: number; // 0 - 100 current frame confidence
    gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down';
    
    // Expressions
    expression: FacialExpressionType;
    smileIntensity: number; // 0 - 100
    browTension: number; // 0 - 100
    isSpeaking: boolean;
    
    // Posture
    postureStatus: PostureStatusType;
    postureScore: number; // 0 - 100
    shoulderTiltAngle: number; // degrees
    headTiltAngle: number; // degrees
    
    // General
    faceDetected: boolean;
    fps: number;
}

export interface SessionBehavioralSummary {
    totalFramesAnalyzed: number;
    sessionDurationSeconds: number;
    
    // Cumulative scores (0 - 100)
    overallPresenceScore: number;
    eyeContactPercentage: number;
    postureStabilityPercentage: number;
    engagementPercentage: number;
    
    // Expression distribution
    expressionDistribution: {
        smilingTimePct: number;
        attentiveTimePct: number;
        speakingTimePct: number;
        neutralTimePct: number;
        otherTimePct: number;
    };
    
    // Key coaching observations
    strengths: string[];
    areasForImprovement: string[];
    coachingAdvice: string[];
    timestamp: string;
}

export interface MediaPipeLandmarksData {
    faceLandmarks?: { x: number; y: number; z: number }[];
    poseLandmarks?: { x: number; y: number; z: number; visibility?: number }[];
}
