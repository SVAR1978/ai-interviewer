import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  fullName?: string;
  username: string;
  email?: string;
  password: string;
  agreedToTerms?: boolean;
  createdAt?: Date;
}

export interface ISubScores {
  technical: number;
  communication: number;
  problemSolving: number;
  presence: number;
  overall: number;
}

export interface ISessionMetrics {
  eyeContactPercentage?: number;
  postureStabilityPercentage?: number;
  engagementPercentage?: number;
  technicalDepth?: string;
  readinessVerdict?: string;
}

export interface ISessionScoreRecord {
  sessionId: string;
  timestamp: Date;
  overallScore: number;
  subScores: ISubScores;
  metrics?: ISessionMetrics;
  feedbackSummary?: string;
}

export interface IScore extends Document {
  username: string;
  /** @deprecated Legacy underscore-separated score string (e.g. "6_8_7_9"). Kept for zero-downtime backward compatibility. */
  lastscore?: string;
  sessions: ISessionScoreRecord[];
  updatedAt?: Date;
}

export interface IQA extends Document {
  username: string;
  questionanswer: string;
}

export interface IQno extends Document {
  username: string;
  qno: string;
}

export interface IImage extends Document {
  username: string;
  image: string;
}

export interface IJobDescription extends Document {
  username: string;
  title: string;
  company: string;
  rawText: string;
  chunkCount: number;
  createdAt: Date;
}

export interface IJDChunk extends Document {
  jobDescriptionId: mongoose.Types.ObjectId;
  username: string;
  chunkText: string;
  chunkIndex: number;
  embedding: number[];
  section: string;
}

export interface IPasswordResetOTP extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  fullName: { type: String, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  agreedToTerms: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const subScoresSchema = new mongoose.Schema<ISubScores>({
  technical: { type: Number, required: true, min: 0, max: 10 },
  communication: { type: Number, required: true, min: 0, max: 10 },
  problemSolving: { type: Number, required: true, min: 0, max: 10 },
  presence: { type: Number, required: true, min: 0, max: 10, default: 7.5 },
  overall: { type: Number, required: true, min: 0, max: 10 },
}, { _id: false });

const sessionMetricsSchema = new mongoose.Schema<ISessionMetrics>({
  eyeContactPercentage: { type: Number, min: 0, max: 100 },
  postureStabilityPercentage: { type: Number, min: 0, max: 100 },
  engagementPercentage: { type: Number, min: 0, max: 100 },
  technicalDepth: { type: String, default: 'Proficient' },
  readinessVerdict: { type: String },
}, { _id: false });

const sessionScoreRecordSchema = new mongoose.Schema<ISessionScoreRecord>({
  sessionId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  overallScore: { type: Number, required: true, min: 0, max: 10 },
  subScores: { type: subScoresSchema, required: true },
  metrics: { type: sessionMetricsSchema, default: () => ({}) },
  feedbackSummary: { type: String, default: '' },
}, { _id: false });

const scoreSchema = new mongoose.Schema<IScore>({
  username: { type: String, required: true, unique: true, index: true },
  lastscore: { type: String, default: '' }, // Deprecated legacy string format (e.g. "6_8_7_9")
  sessions: { type: [sessionScoreRecordSchema], default: [] },
}, { timestamps: true });

const qaSchema = new mongoose.Schema<IQA>({
  username: String,
  questionanswer: String,
});

const qnoSchema = new mongoose.Schema<IQno>({
  username: String,
  qno: String,
});

const imageSchema = new mongoose.Schema<IImage>({
  username: String,
  image: String,
});

const jobDescriptionSchema = new mongoose.Schema<IJobDescription>({
  username: { type: String, required: true, index: true },
  title: { type: String, required: true },
  company: { type: String, default: '' },
  rawText: { type: String, required: true },
  chunkCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const jdChunkSchema = new mongoose.Schema<IJDChunk>({
  jobDescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobDescription', required: true, index: true },
  username: { type: String, required: true, index: true },
  chunkText: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  embedding: { type: [Number], required: true },
  section: { type: String, default: 'general' },
});

const passwordResetOTPSchema = new mongoose.Schema<IPasswordResetOTP>({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', userSchema);
export const Score = mongoose.model<IScore>('Score', scoreSchema);
export const QA = mongoose.model<IQA>('QA', qaSchema);
export const Qno = mongoose.model<IQno>('Qno', qnoSchema);
export const ImageModel = mongoose.model<IImage>('Image', imageSchema);
export const JobDescription = mongoose.model<IJobDescription>('JobDescription', jobDescriptionSchema);
export const JDChunk = mongoose.model<IJDChunk>('JDChunk', jdChunkSchema);
export const PasswordResetOTP = mongoose.model<IPasswordResetOTP>('PasswordResetOTP', passwordResetOTPSchema);

