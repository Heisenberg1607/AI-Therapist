# MindStudio — AI Therapy Assistant

A real-time AI therapy assistant that lets users have voice-based conversations with an AI therapist. The AI listens, responds with synthesized speech, and detects crisis situations automatically.

**Live Demo:** https://ai-therapist-tau.vercel.app

---

## Features

- Push-to-talk voice recording with live transcript
- Real-time audio streaming via WebSockets (Socket.IO)
- AI responses powered by OpenAI GPT-4o-mini
- Natural voice synthesis via ElevenLabs TTS
- JWT-based authentication (register / login)
- Crisis detection with automatic intervention modal
- Interrupt AI mid-response
- Rate limiting (3 messages per 10 seconds)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Express 5, Socket.IO 4, TypeScript |
| AI | OpenAI GPT-4o-mini |
| Text-to-Speech | ElevenLabs `eleven_flash_v2_5` |
| Database | PostgreSQL (Supabase), Prisma ORM |
| Auth | JWT (3-day expiry) |
| Deployment | Frontend → Vercel, Backend → Render |

---

## Running Locally

### Prerequisites

- Node.js 20+
- A PostgreSQL database — free tier on [Supabase](https://supabase.com) works perfectly
- API keys for: OpenAI, ElevenLabs

### 1. Clone the repo

```bash
git clone <repo-url>
cd ai-therapist
```

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:6543/<db>?pgbouncer=true&connection_limit=1
JWT_SECRET=any-long-random-string
OPENAI_API_KEY=sk-...
ELEVEN_LABS_API_KEY=sk-...
PORT=5001
FRONTEND_URL=http://localhost:3000
```

> Use port **6543** (PgBouncer) for `DATABASE_URL` — port 5432 will cause connection pool timeouts locally.

```bash
npm install
npx prisma migrate dev --schema=./src/prisma/schema.prisma
npm run dev
```

Backend runs at **http://localhost:5001**

### 3. Set up the frontend

```bash
cd ../frontend
cp .env.example .env.local
```

Open `frontend/.env.local` and set:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_WS_URL=http://localhost:5001
```

```bash
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

### 4. Open the app

Go to http://localhost:3000 → Register → Start Session → click the mic to talk.

---

## Running with Docker

### Prerequisites

- Docker and Docker Compose

### Steps

```bash
# Fill in backend env
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys and DATABASE_URL

# Fill in frontend env
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:5001/api
#   NEXT_PUBLIC_WS_URL=http://localhost:5001

# Build and run
docker-compose up --build -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5001
- Health check: http://localhost:5001/api/health

```bash
# Stop
docker-compose down
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | No | Create account |
| `POST` | `/api/login` | No | Login, returns JWT |
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/startSession` | Bearer JWT | Create a new therapy session |

### WebSocket Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `sendMessage` | Client → Server | Send user transcript + sessionId |
| `audioChunk` | Server → Client | Streamed MP3 audio bytes |
| `audioComplete` | Server → Client | Audio stream finished, includes AI text |
| `audioError` | Server → Client | Error during processing |
| `aiThinking` | Server → Client | AI is generating a response |
| `crisisDetected` | Server → Client | Crisis keywords detected |
| `interrupt` | Client → Server | Stop current AI audio stream |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (use port 6543 for Supabase) |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ELEVEN_LABS_API_KEY` | Yes | ElevenLabs API key |
| `PORT` | No | Server port (default: `5001`) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (e.g. `https://yourapp.vercel.app`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend REST URL including `/api` (e.g. `http://localhost:5001/api`) |
| `NEXT_PUBLIC_WS_URL` | Yes | Backend WebSocket root URL without `/api` (e.g. `http://localhost:5001`) |

---

## Project Structure

```
ai-therapist/
├── backend/
│   ├── src/
│   │   ├── Controller/     # Route handlers (auth, session)
│   │   ├── Model/          # Prisma DB helpers (user, session, message)
│   │   ├── Routes/         # Express router
│   │   ├── Service/        # OpenAI + ElevenLabs integration
│   │   ├── middleware/      # JWT auth middleware
│   │   ├── prisma/         # Prisma schema + client
│   │   ├── utils/          # JWT helpers
│   │   └── server.ts       # Express + Socket.IO entrypoint
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── UI/             # Page-level components (chat windows, navbar)
│   │   ├── hooks/          # useWebSocket, useUserCallWindow
│   │   ├── context/        # Auth + call context
│   │   ├── lib/            # API client, auth helpers
│   │   └── chat/           # Chat page
│   └── Dockerfile
└── docker-compose.yml
```
