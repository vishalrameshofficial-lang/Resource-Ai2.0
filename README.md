# RESOURCEAI
### AI-Powered Multilingual Disaster Emergency Response & Resource Allocation Platform

> **Exotel AgentStream · Voicebot WebSocket · Node.js 22+ (native `node:sqlite`) · React 18+ · Tailwind CSS · Leaflet**

---

## 1. Overview & Architecture

**ResourceAI** is a mission-critical disaster management and relief coordination platform connecting affected citizens with government and emergency relief administrators.

Emergency requests enter via two integrated channels:
1. **Interactive AI Helpline (Phone Call)**: Citizen dials a fixed Exotel helpline number (`+91 8047359000`). The call streams bidirectionally over WebSockets (`Exotel AgentStream`) to an empathetic AI voice agent that converses naturally across 8 Indian languages, extracts structured crisis triage parameters, and confirms the request before recording it.
2. **Citizen Web Intake Portal**: Responsive emergency assistance web form with **Offline Resilience** (queues locally with exponential backoff and jitter; never falsely claims government dispatch while offline).

```
Citizen Phone Call
      ↓
Exotel Helpline (+91 8047359000)
      ↓ (Bidirectional WebSocket)
wss://YOUR_DOMAIN/api/voice/exotel/stream
      ↓
Node.js Voicebot Engine (server.js:5055)
      ↓
Speech-To-Text (Whisper / Provider Abstraction)
      ↓
Conversational AI Manager (8 Languages, Strict Safety Guardrails)
      ↓
Validated Structured Emergency JSON
      ↓
Text-To-Speech (Telephony PCM / mu-law audio back to Exotel)
      ↓
SQLite Database (native node:sqlite)
      ↓
Real-Time Server-Sent Events (SSE /api/events)
      ↓
React SaaS Admin Dashboard (port 3000)
      ↓
Relief Verification & Government Dispatch (SDRF / NDRF / DDMA)
```

---

## 2. Technology Stack

- **Backend**:
  - Node.js 22+ (ES Modules)
  - Express.js (Port `5055`)
  - Native `node:sqlite` (`DatabaseSync` - zero native-gyp compile issues)
  - Official Exotel `AgentStream` Bidirectional WebSocket (`ws`)
  - Server-Sent Events (SSE) for live dashboard streaming
  - JWT Authentication (RBAC: `ADMIN`, `OPERATOR`, `VIEWER`)
- **Database**:
  - SQLite database at `server/data/resourceai.db`
  - Tables: `emergency_requests`, `call_sessions`, `dispatch_timeline`, `users`
- **Frontend**:
  - React 18+, TypeScript, Vite (Port `3000`, proxy `/api` -> `http://localhost:5055`)
  - Tailwind CSS (Dark Glassmorphic UI with Disaster Triage Accents)
  - Lucide React icons
  - Leaflet Disaster Incident Heatmap
  - Web Speech API integration for in-browser Voice Testing
- **Supported Languages**:
  - English, Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Odia

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js 22+ installed (`node -v` >= 22.0.0)
- npm installed

### 1. Install Dependencies
```bash
# Install root (backend) dependencies
npm install

# Install client (frontend) dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` values are pre-configured to run out-of-the-box in local development with mock provider fallback and native SQLite!

### 3. Run Automated Tests
```bash
npm test
```
Runs the full automated test suite using Node's native test runner (`node:test`):
- Emergency schema validation & normalization
- Multi-turn conversational flow matching Section 2 requirements
- Strict safety guardrail verification
- Exotel AgentStream protocol & telephony audio buffer generation
- Live API integration tests

### 4. Run Both Servers
```bash
npm run dev:all
```
- **Backend API & WebSockets**: `http://localhost:5055`
- **Frontend Admin Dashboard**: `http://localhost:3000`
- **Health Check Endpoint**: `http://localhost:5055/api/health`

---

## 4. Default Credentials (RBAC)

The database automatically seeds 3 administrative accounts on first boot:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@resourceai.org` | `admin123` | Full access, system config, dispatch |
| **OPERATOR** | `operator@resourceai.org` | `operator123` | Request triage, government dispatch |
| **VIEWER** | `viewer@resourceai.org` | `viewer123` | Read-only analytics & map monitoring |

*(Note: The dashboard auto-authenticates the default administrator for hackathon demo convenience, with a quick role switcher in the top navigation bar).*

---

## 5. Exotel AgentStream Telephony Setup

### Connecting Exotel to ResourceAI

1. **Expose Localhost via Public Tunnel**:
   Because Exotel telephony servers cannot reach `localhost` directly, run an HTTPS tunnel such as ngrok:
   ```bash
   ngrok http 5055
   ```
   Copy your forwarding HTTPS URL (e.g. `https://abc123xyz.ngrok-free.app`) and set it in `.env`:
   ```env
   PUBLIC_BASE_URL=https://abc123xyz.ngrok-free.app
   ```

2. **Configure Exotel App Bazaar Flow**:
   - In your Exotel Dashboard, create or edit a Flow.
   - Add the **Voicebot / AgentStream Applet**.
   - Select **WebSocket Streaming**.
   - Set the WebSocket URL to:
     ```
     wss://YOUR_DOMAIN/api/voice/exotel/stream
     ```
   - Set **Audio Codec** to `audio/l16` or `audio/x-mulaw`.
   - Set **Sample Rate** to `8000 Hz` Mono.
   - Assign your incoming ExoPhone number (`+91 8047359000`) to this flow.

### In-Browser Voicebot Simulator
Don't have an active phone on hand? Use the **Voicebot & Exotel Simulator** built directly into the admin dashboard:
- Navigate to the **Voicebot & Exotel** tab.
- Click quick utterances or type custom replies.
- The simulator utilizes browser speech synthesis to vocalize the AI's response in Tamil, Hindi, English, and more!
- Watch real-time stage progression and live structured entity extraction.

---

## 6. Strict AI Safety & Truth Rules

1. **Zero False Claims**: The AI Voice Agent will **NEVER** claim that government responders or relief squads have received, accepted, or dispatched help unless the backend has recorded that state.
2. **Clear Scripting**: The AI explicitly confirms: *"Your emergency request has been recorded in ResourceAI. Your request ID is REQ-XXXX."*
3. **No Estimated Arrival Guarantees**: The agent never promises arbitrary delivery arrival times (e.g., "Help will arrive in 20 minutes" is forbidden).
4. **Life Threat Prioritization**: If the caller describes someone trapped, bleeding, or in flood danger, the agent prioritizes collecting their exact location/landmark and instructs them to seek safety.
5. **Privacy Safeguards**: PII phone numbers are masked by default (`+91 ******3210`) with reveal toggle for authorized admins.

---

## 7. Offline Resilience Engine

The Citizen Portal uses an offline-first resilient architecture:
- If a citizen submits an emergency request during a power outage or cell tower drop, the request is stored in `localStorage` under `resourceai_emergency_queue`.
- The UI shows: **"Saved locally — waiting for network"** (never claiming central dispatch received it).
- As soon as connectivity returns, an automatic background queue worker retries dispatch using **exponential backoff with random jitter**.
- Once the backend returns `201 Created`, the status updates to **Confirmed** with the persistent Request ID.

---

## 8. Government Dispatch Pipeline

The admin dashboard provides an audited pipeline with explicit separation between:
- **Recorded by ResourceAI** (citizen crisis report registered)
- **Confirmed by Government** (official agency reference recorded)

Workflow progression:
1. `NEW` → Request registered
2. `VERIFIED` → Relief officer confirms legitimacy
3. `FORWARDED_TO_GOVERNMENT` → Assigned to SDRF / NDRF / DDMA with official reference #
4. `RESOURCE_ALLOCATED` → Rescue boats, food packets, medical kits assigned
5. `DELIVERY_IN_PROGRESS` → Relief team in transit
6. `DELIVERED` → Relief handed over and situation stabilized

---

## 9. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health, SQLite status, uptime |
| `GET` | `/api/requests` | List emergency requests (filterable) |
| `GET` | `/api/requests/:id` | Detailed request with timeline & call transcript |
| `POST` | `/api/requests` | Citizen web intake or API emergency submission |
| `PATCH`| `/api/requests/:id/status` | Update status with admin audit log |
| `GET` | `/api/calls` | Call history and transcripts |
| `GET` | `/api/calls/active` | Live in-flight calls |
| `GET` | `/api/stats` | Dashboard metrics and category breakdown |
| `GET` | `/api/exotel/status` | Exotel configuration and public WSS URL |
| `POST` | `/api/voice/test` | Voice agent simulator test endpoint |
| `GET` | `/api/events` | Server-Sent Events (SSE) live push stream |
| `WS` | `/api/voice/exotel/stream` | Official Exotel AgentStream WebSocket |

---

## 10. License

MIT License. Built for hackathon demonstration and disaster emergency resilience.
