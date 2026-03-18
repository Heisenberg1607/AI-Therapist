# AI Therapist

A real-time AI therapy assistant using voice conversations powered by OpenAI GPT-4o and ElevenLabs TTS.

## Setup

### 1. Clone the repo
git clone ...

### 2. Backend
cd backend
cp .env.example .env       # fill in your keys
npm install
npx prisma migrate dev
npm run dev

### 3. Frontend
cd frontend
cp .env.example .env.local  # fill in API URL
npm install
npm run dev