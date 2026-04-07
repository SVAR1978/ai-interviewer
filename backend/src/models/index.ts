import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
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

const userSchema = new mongoose.Schema<IUser>({
  username: String,
  password: String,
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

export const User = mongoose.model<IUser>('User', userSchema);
export const Score = mongoose.model<IScore>('Score', scoreSchema);
export const QA = mongoose.model<IQA>('QA', qaSchema);
export const Qno = mongoose.model<IQno>('Qno', qnoSchema);
export const ImageModel = mongoose.model<IImage>('Image', imageSchema);
