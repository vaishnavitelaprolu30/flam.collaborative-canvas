# SyncSketch — Interview Guide

This guide answers technical questions about SyncSketch's canvas, real-time collaboration, and AI systems architecture, matching the exact implementation within this repository.

---

### 1. How does real-time collaboration work?
Real-time collaboration is powered by a Client-Server architecture utilizing:
- **WebSocket Protocol (Socket.IO)**: For ephemeral data streaming (cursors, trails, text-typing states, transient in-progress drawing strokes).
- **REST APIs (Express + SQLite)**: For persistent actions (saving element creations, deletions, color updates, version checkpoints, board metadata).
- **Zustand Stores**: Separate store modules for canvas state (`useBoardStore`) and multiplayer presence (`usePresenceStore`).

---

### 2. Why WebSockets?
Whiteboards require bidirectional, low-latency communication.
- **WebSockets** maintain a single, long-lived TCP connection, bypassing the overhead of HTTP headers and TLS handshake negotiation on every coordinate change.
- **Socket.IO** provides automatic reconnection, room scoping (channels), and packet buffering in case of client reconnect gaps.

---

### 3. How do you prevent cursor events from causing too many renders?
We deploy two distinct performance optimization tactics:
1. **Outgoing (Throttling)**: Local mouse movements are intercepted and throttled to $\le 30\text{ Hz}$ (~33ms intervals) before transmitting to the Socket.IO server. This filters out 75% of raw mouse packets, reducing server load.
2. **Incoming (Target Interpolation & requestAnimationFrame)**:
   - When a remote cursor update is received, it does NOT trigger a React re-render. Instead, it updates the collaborator's `targetX` and `targetY` coordinates in the store.
   - A local `requestAnimationFrame` loop runs a smooth linear interpolation (lerp) glide on each cursor, updating coordinates smoothly without raw DOM manipulations.

---

### 4. How does AI understand the canvas?
Instead of sending screenshots (which lose structural coordinates and are expensive), SyncSketch serializes selected elements into a clean, structured JSON context schema:
```json
{
  "boardTitle": "Title",
  "selectedElements": [
    { "id": "1", "type": "sticky", "text": "Auth Layer", "x": 100, "y": 200 }
  ]
}
```
This is passed to a backend endpoint `/api/ai/analyze` which prompts Gemini to analyze semantic relations and return clean markdown.

---

### 5. Why structured JSON instead of raw AI text?
Structured JSON ensures that:
- Coordinates, connectors, colors, and node shapes are represented exactly.
- The LLM can interpret logical topology (e.g., node connections) rather than estimating coordinates from pixels.
- The payload remains lightweight.

---

### 6. How does version history differ from undo?
- **Undo / Redo**: A client-side state history stack (`past` and `future` element arrays). It is local to the current active session, transient, and records minute keystrokes and drags.
- **Version History (Checkpoints)**: Named snapshots persisted in the SQLite database (`board_versions` table). They represent milestone changes, survive tab refreshes, and can be reviewed, previewed in read-only overlay modes, or fully restored.

---

### 7. What happens when network connection drops?
SyncSketch detects disconnects and updates the status indicator in the top-right header to `Offline` (or `Reconnecting`).
- **Offline Operations**: Drawing, creating sticky notes, and text modifications continue locally using local React state and the local Zustand cache.
- **Connection Restoration**: When WebSockets reconnect, the system syncs local state, clear presence arrays, and fetches database sync tables.

---

### 8. How do you protect API keys?
We enforce a strict security boundary between client and backend:
- The Gemini API Key (`GEMINI_API_KEY`) is stored securely inside server-side environment configurations (`.env`) and is **never** sent to the client browser.
- The frontend initiates queries through the Express proxy server endpoint `/api/ai/analyze`, which handles authentication and limits client exposure.
- If the developer/recruiter runs the app without a key, the backend returns a mock, context-rich simulation explaining exactly how the Gemini model evaluates their specific shapes, ensuring a zero-crash environment.
