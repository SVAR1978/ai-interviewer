# 🧠 AI Interviewer

**A full-stack AI-powered mock interview platform** that combines real-time voice interaction, computer vision-based behavioral analysis, and RAG-grounded question generation to deliver enterprise-grade interview preparation.

Built with React 19, Node.js, Socket.io, Google Gemini 2.5 Flash, MediaPipe WASM, Deepgram Nova-2, and Microsoft Azure AI Speech.

---

## ✨ Key Features

### 🎙️ Real-Time AI Interview Sessions
- **Socket.io-powered streaming** — AI questions stream token-by-token in real-time via `generateContentStream()`
- **Dual-provider Speech-to-Text** — Deepgram Nova-2 real-time streaming with Web Speech API fallback
- **Neural Text-to-Speech** — Microsoft Azure AI Speech (`en-US-JennyNeural`) with browser `SpeechSynthesis` fallback
- **Stream interruption** — Candidates can interrupt AI mid-response

### 👁️ MediaPipe Behavioral Analysis (WebAssembly)
- **Real-time face & pose tracking** — 478 face landmarks + 52 blendshapes + iris tracking + pose landmarking, all running client-side via WASM
- **Eye contact detection** — Blendshape gaze vectors + geometric iris position + head yaw/pitch fusion
- **Posture analysis** — Shoulder tilt angle, slouch detection, head roll monitoring
- **Facial expression classification** — Smiling, Speaking, Puzzled, Attentive, Neutral
- **Live coaching tips** — Real-time contextual feedback shown in the Webcam Presence HUD
- **Session telemetry** — Aggregated behavioral metrics fed into the scoring pipeline

### 🧬 Hybrid RAG Pipeline (Dense + BM25 via RRF)
- **Job Description ingestion** — Section-based chunking with overlapping window fallback
- **Gemini Embedding-001** — 768-dimensional vector embeddings stored in MongoDB
- **Hybrid retrieval** — Cosine similarity (dense) + custom BM25 index (sparse) fused via Reciprocal Rank Fusion (k=60)
- **JD-grounded questions** — Interview questions are contextually anchored to the job description requirements
- **Resume gap analysis** — AI identifies missing skills and weak areas by comparing resume against stored JDs

### 📊 Dual-Pillar AI Scoring System
- **60% Technical Accuracy** — Gemini evaluates answers for technical depth, problem-solving, and communication
- **40% Behavioral Confidence** — MediaPipe session telemetry (eye contact %, posture stability %, engagement %)
- **Multi-domain sub-scores** — Technical, Problem Solving, Communication, Presence, Overall
- **Readiness verdicts** — "Strong Hire", "Hire", "Technically Proficient", or "Developing Candidate"
- **Multi-session trajectory analytics** — Track performance trends across interviews with AI coaching suggestions

### 🔄 Rolling Context Summarization
- **Token-efficient context management** — Condenses older Q&A turns into high-density checkpoint summaries
- **Redis-cached summaries** — Avoids redundant LLM summarization calls
- **Progressive sliding window** — Raw transcript for turns 1–2, compressed checkpoints for turns 3+

### 📝 AI Resume Analysis
- **PDF parsing** — Upload resume PDFs with `pdf-parse` text extraction
- **OCR support** — Tesseract.js for extracting text from resume images
- **Structured AI feedback** — Overall score, ATS score, strengths, improvements, missing skills, formatting tips

### 🔐 Authentication & Security
- **JWT-based authentication** — 7-day expiry, stateless verification
- **Email/Username dual login** — Sign in with either identifier
- **OTP password reset** — 6-digit codes via SMTP email with 10-minute TTL
- **Styled HTML email templates** — Dark-themed branded password reset emails

### ⚡ Redis Performance Layer (Upstash)
- **Write-through caching** — Session transcripts, question numbers, rolling summaries, score history
- **O(1) APPEND operations** — Sub-millisecond answer appending in Redis
- **Graceful degradation** — Automatic MongoDB fallback when Redis is unavailable
- **15-second heartbeat** — Keeps Upstash serverless connections warm

---

## 🏗️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js 18 + Express 4.21 | Server runtime & REST API |
| TypeScript 5.5+ | Full type safety |
| MongoDB + Mongoose 8.11 | Primary database |
| Socket.io 4.8 | Real-time bidirectional communication |
| Redis (ioredis 6.0 / Upstash) | In-memory session caching |
| Google Gemini 2.5 Flash | AI question generation & scoring |
| Gemini Embedding-001 | 768-dim vector embeddings for RAG |
| Deepgram SDK 5.10 (Nova-2) | Real-time streaming STT |
| Azure Cognitive Services Speech SDK | Neural TTS |
| AssemblyAI 4.9 | File-based audio transcription |
| Nodemailer 10.0 | Transactional email (SMTP) |
| pdf-parse | PDF text extraction |
| Multer | File upload handling |
| JWT (jsonwebtoken) | Stateless authentication |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + TypeScript 6.0 | Component-based UI |
| Vite 8.0 | Dev server & build tooling |
| React Router DOM 7.14 | Client-side routing |
| Socket.io Client 4.8 | WebSocket communication |
| MediaPipe Tasks Vision (WASM) | Face & pose landmarking |
| Chart.js + react-chartjs-2 | Performance analytics charts |
| Lucide React | SVG icon library |
| Tesseract.js 7.0 | Client-side OCR |
| Spline React | 3D animated landing page elements |
| Web Speech API | Browser STT/TTS fallback |

---

## 📂 Repository Structure

```
ai-interviewer/
├── backend/
│   ├── src/
│   │   ├── app.ts                    # Express app configuration
│   │   ├── index.ts                  # Server entry point (HTTP + Socket.io)
│   │   ├── config/
│   │   │   ├── db.ts                 # MongoDB connection
│   │   │   └── env.ts                # Environment variable management
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts    # Auth: signup, signin, OTP reset
│   │   │   ├── interview.controller.ts # Interview: scoring, resume, Q&A
│   │   │   └── rag.controller.ts     # RAG: JD ingestion, gap analysis
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts     # JWT verification middleware
│   │   ├── models/
│   │   │   └── index.ts              # All Mongoose schemas & models
│   │   ├── routes/
│   │   │   ├── auth.routes.ts        # /auth endpoints
│   │   │   ├── interview.routes.ts   # /api interview endpoints
│   │   │   └── rag.routes.ts         # /api/rag endpoints
│   │   ├── services/
│   │   │   ├── email.service.ts      # Nodemailer SMTP service
│   │   │   ├── rag.service.ts        # Chunking, embedding, hybrid search
│   │   │   ├── redis.service.ts      # Upstash Redis caching layer
│   │   │   ├── rollingContext.service.ts # Token-efficient summarization
│   │   │   ├── stt.service.ts        # Deepgram live STT service
│   │   │   └── tts.service.ts        # Azure Neural TTS service
│   │   └── sockets/
│   │       └── interview.socket.ts   # Socket.io event handlers
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json                   # Vercel deployment config
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Root component with routing
│   │   ├── main.tsx                  # React entry point
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx   # Authenticated layout wrapper
│   │   │   ├── LoaderOverlay.tsx     # Loading animations
│   │   │   └── WebcamPresenceHUD.tsx # Real-time behavioral telemetry UI
│   │   ├── hooks/
│   │   │   ├── useInterviewSocket.ts # Socket.io interview hook
│   │   │   ├── useMediaPipeVision.ts # MediaPipe face/pose tracking hook
│   │   │   ├── useProAudioRecorder.ts # Deepgram + browser STT hook
│   │   │   └── useProAudioPlayer.ts  # Azure + browser TTS playback hook
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Marketing landing page
│   │   │   ├── Signin.tsx            # Sign in page
│   │   │   ├── Signup.tsx            # Registration page
│   │   │   ├── ForgotPassword.tsx    # OTP password reset flow
│   │   │   ├── Dashboard.tsx         # User dashboard
│   │   │   ├── Interview.tsx         # Interview setup page
│   │   │   ├── InterviewSession.tsx  # Live interview session
│   │   │   ├── ResumeAnalysis.tsx    # AI resume review
│   │   │   ├── ScoreSummary.tsx      # Multi-session analytics
│   │   │   ├── ScoreDetail.tsx       # Individual session deep-dive
│   │   │   └── JobDescriptions.tsx   # JD management (CRUD)
│   │   ├── services/
│   │   │   ├── api.ts                # REST API client
│   │   │   └── socket.ts            # Socket.io client instance
│   │   ├── styles/                   # CSS stylesheets
│   │   └── types/                    # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── shared/                           # Shared types, constants, validators
└── docs/                             # Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x
- MongoDB instance (local or Atlas)
- API keys for: Google Gemini, Deepgram (optional), Azure Speech (optional), AssemblyAI (optional)

### Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file (see `.env.example`):
```env
PORT=3000
mongourl=mongodb+srv://...
jsonpassword=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
REDIS_URL=rediss://...                    # Optional: Upstash Redis
DEEPGRAM_API_KEY=your_deepgram_key        # Optional: Real-time STT
AZURE_SPEECH_KEY=your_azure_key           # Optional: Neural TTS
AZURE_SPEECH_REGION=eastus                # Optional
SMTP_USER=your_email@gmail.com            # Optional: Password reset emails
SMTP_PASS=your_app_password               # Optional
```

Start the development server:
```bash
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` by default and connects to the backend at `http://localhost:3000`.

---

## 🔌 API Reference

### Auth Endpoints (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/signup` | Create new account |
| `POST` | `/auth/signin` | Login (email or username) |
| `POST` | `/auth/forgot-password` | Send OTP to email |
| `POST` | `/auth/verify-otp` | Verify 6-digit OTP |
| `POST` | `/auth/reset-password` | Reset password |
| `GET` | `/auth/profile` | Get user profile (JWT required) |

### Interview Endpoints (`/api`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/interview` | Generate interview question |
| `POST` | `/api/addanswer` | Submit an answer |
| `POST` | `/api/score` | Generate AI evaluation score |
| `POST` | `/api/home` | Reset interview session |
| `POST` | `/api/checkscore` | Get score history & analytics (JWT required) |
| `POST` | `/api/checkresume` | AI resume analysis (file upload) |
| `POST` | `/api/transcribe` | Transcribe audio file |

### RAG Endpoints (`/api/rag`) — All require JWT
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rag/ingest` | Ingest a job description |
| `GET` | `/api/rag/job-descriptions` | List all job descriptions |
| `DELETE` | `/api/rag/job-descriptions/:id` | Delete a job description |
| `POST` | `/api/rag/gap-analysis` | Resume vs JD gap analysis |

---

## 🏛️ Architecture Highlights

- **Service Layer Pattern** — Business logic abstracted into reusable services (RAG, Redis, STT, TTS, Email, Rolling Context)
- **Graceful Degradation** — Every external dependency (Redis, Deepgram, Azure, MediaPipe) has an automatic fallback
- **Write-Through Caching** — Redis for speed, MongoDB for durability
- **Exponential Backoff Retry** — All Gemini API calls handle 503/429 with progressive retries
- **Custom React Hooks** — Domain-specific hooks encapsulate complex Socket.io, MediaPipe, and audio logic
- **Real-Time Streaming** — Questions stream word-by-word for a natural conversational experience
- **Client-Side Computer Vision** — All behavioral analysis runs in the browser via WebAssembly (zero server cost)

---

## 📄 License

ISC
