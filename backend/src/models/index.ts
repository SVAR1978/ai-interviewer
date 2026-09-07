import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  fullName?: string;
  username: string;
  email?: string;
  password: string;
  agreedToTerms?: boolean;
  createdAt?: Date;
}

export interface IScore extends Document {
  username: string;
  lastscore: string;
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

const scoreSchema = new mongoose.Schema<IScore>({
  username: String,
  lastscore: String,
});

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

