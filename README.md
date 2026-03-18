# AI Therapist

A real-time AI therapy assistant using voice conversations powered by OpenAI GPT-4o-mini and ElevenLabs TTS.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL database (e.g. [Supabase](https://supabase.com))

### 1. Clone the repo

```bash
git clone <repo-url>
cd ai-therapist
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # fill in your API keys and DATABASE_URL
npm install
npx prisma migrate dev     # run DB migrations
npm run dev                # starts on http://localhost:5001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:5001
npm install
npm run dev                  # starts on http://localhost:3000
```

---

## Production with Docker

### Prerequisites

- Docker & Docker Compose

### 1. Configure environment files

```bash
# Backend secrets
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DATABASE_URL, API keys, JWT_SECRET, and set FRONTEND_URL to your frontend domain

# Frontend env
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local — set NEXT_PUBLIC_API_URL to your backend's public URL
```

### 2. Build and run

```bash
docker-compose up --build -d
```

The app will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001`

### 3. Stop

```bash
docker-compose down
```

---

## Deploying to a Cloud Platform

### Render / Railway / Fly.io (recommended)

Both services can be deployed separately:

**Backend** (Node.js service):
- Build command: `npm run build:prod`
- Start command: `npm start` (runs `prisma migrate deploy` then starts the server)
- Set all env vars from `backend/.env.example`
- Set `FRONTEND_URL` to your deployed frontend URL

**Frontend** (Next.js service):
- Build command: `npm run build`
- Start command: `npm start`
- Set `NEXT_PUBLIC_API_URL` to your deployed backend URL at **build time**

### Vercel (frontend only)

```bash
cd frontend
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` in the Vercel project environment variables.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (use a long random string) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ELEVEN_LABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID |
| `PORT` | Server port (default: `5001`) |
| `FRONTEND_URL` | Deployed frontend URL for CORS (e.g. `https://yourapp.com`) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL for REST + WebSocket (e.g. `https://api.yourapp.com`) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Backend | Express 5, Socket.IO 4, TypeScript |
| AI | OpenAI GPT-4o-mini |
| TTS | ElevenLabs `eleven_flash_v2_5` |
| Database | PostgreSQL via Supabase, Prisma ORM |
| Auth | JWT |
