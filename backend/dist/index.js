"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Express REST API endpoints
// 1. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'SyncSketch backend is operational' });
});
// 2. Fetch Board Library list (Search and sorting supported)
app.get('/api/boards', async (req, res) => {
    try {
        const search = req.query.search || '';
        const sort = req.query.sort || 'recently_edited';
        let orderClause = 'updated_at DESC';
        if (sort === 'recently_created') {
            orderClause = 'created_at DESC';
        }
        else if (sort === 'alphabetical') {
            orderClause = 'title ASC';
        }
        const boards = await (0, db_1.query)(`SELECT * FROM boards WHERE title LIKE ? ORDER BY ${orderClause}`, [`%${search}%`]);
        res.json(boards);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. Create a new Board
app.post('/api/boards', async (req, res) => {
    try {
        const { id, title } = req.body;
        const boardId = id || Math.random().toString(36).substring(2, 9);
        const boardTitle = title || 'Untitled Board';
        const now = Date.now();
        await (0, db_1.run)('INSERT INTO boards (id, title, favorite, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', [boardId, boardTitle, now, now]);
        res.status(201).json({ id: boardId, title: boardTitle, favorite: 0 });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 4. Retrieve single Board elements
app.get('/api/boards/:id', async (req, res) => {
    try {
        const boardId = req.params.id;
        // Check if board exists
        const boards = await (0, db_1.query)('SELECT * FROM boards WHERE id = ?', [boardId]);
        if (boards.length === 0) {
            // Create board on the fly if requested
            const now = Date.now();
            await (0, db_1.run)('INSERT INTO boards (id, title, favorite, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', [boardId, 'Untitled Board', now, now]);
            res.json({ id: boardId, title: 'Untitled Board', favorite: 0, elements: [] });
            return;
        }
        const elementsRaw = await (0, db_1.query)('SELECT data FROM board_elements WHERE board_id = ?', [boardId]);
        const elements = elementsRaw.map((row) => JSON.parse(row.data));
        res.json({
            ...boards[0],
            elements
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 5. Update/Save Board elements
app.put('/api/boards/:id', async (req, res) => {
    try {
        const boardId = req.params.id;
        const { title, favorite, elements } = req.body;
        const now = Date.now();
        // 1. Update Board metadata
        if (title !== undefined && favorite !== undefined) {
            await (0, db_1.run)('UPDATE boards SET title = ?, favorite = ?, updated_at = ? WHERE id = ?', [title, favorite, now, boardId]);
        }
        else if (title !== undefined) {
            await (0, db_1.run)('UPDATE boards SET title = ?, updated_at = ? WHERE id = ?', [title, now, boardId]);
        }
        else if (favorite !== undefined) {
            await (0, db_1.run)('UPDATE boards SET favorite = ?, updated_at = ? WHERE id = ?', [favorite, now, boardId]);
        }
        else {
            await (0, db_1.run)('UPDATE boards SET updated_at = ? WHERE id = ?', [now, boardId]);
        }
        // 2. Save Elements
        if (elements && Array.isArray(elements)) {
            await (0, db_1.run)('DELETE FROM board_elements WHERE board_id = ?', [boardId]);
            for (const el of elements) {
                await (0, db_1.run)('INSERT OR REPLACE INTO board_elements (id, board_id, data) VALUES (?, ?, ?)', [el.id, boardId, JSON.stringify(el)]);
            }
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 6. Delete a Board
app.delete('/api/boards/:id', async (req, res) => {
    try {
        const boardId = req.params.id;
        await (0, db_1.run)('DELETE FROM boards WHERE id = ?', [boardId]);
        await (0, db_1.run)('DELETE FROM board_elements WHERE board_id = ?', [boardId]);
        await (0, db_1.run)('DELETE FROM board_versions WHERE board_id = ?', [boardId]);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 7. Fetch Board version snapshot history
app.get('/api/boards/:id/versions', async (req, res) => {
    try {
        const boardId = req.params.id;
        const versions = await (0, db_1.query)('SELECT id, name, is_autosave, created_at FROM board_versions WHERE board_id = ? ORDER BY created_at DESC', [boardId]);
        res.json(versions);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 8. Fetch elements of a specific historical version
app.get('/api/boards/:id/versions/:versionId', async (req, res) => {
    try {
        const { versionId } = req.params;
        const versions = await (0, db_1.query)('SELECT data FROM board_versions WHERE id = ?', [versionId]);
        if (versions.length === 0) {
            res.status(404).json({ error: 'Version not found' });
            return;
        }
        res.json({ elements: JSON.parse(versions[0].data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 9. Save a Version snapshot checkpoint
app.post('/api/boards/:id/versions', async (req, res) => {
    try {
        const boardId = req.params.id;
        const { name, elements, isAutosave } = req.body;
        const versionId = Math.random().toString(36).substring(2, 9);
        const now = Date.now();
        await (0, db_1.run)('INSERT INTO board_versions (id, board_id, name, data, is_autosave, created_at) VALUES (?, ?, ?, ?, ?, ?)', [versionId, boardId, name || 'Autosave', JSON.stringify(elements), isAutosave ? 1 : 0, now]);
        // Keep version count capped per board to avoid infinite database growth
        const countRow = await (0, db_1.query)('SELECT COUNT(*) as cnt FROM board_versions WHERE board_id = ?', [boardId]);
        if (countRow[0].cnt > 30) {
            const oldest = await (0, db_1.query)('SELECT id FROM board_versions WHERE board_id = ? ORDER BY created_at ASC LIMIT 1', [boardId]);
            if (oldest.length > 0) {
                await (0, db_1.run)('DELETE FROM board_versions WHERE id = ?', [oldest[0].id]);
            }
        }
        res.status(201).json({ id: versionId, name, created_at: now });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/ai/analyze', async (req, res) => {
    try {
        const { action, context, prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        let systemInstructions = `You are a senior systems engineer and real-time architect inside the SyncSketch collaborative whiteboard environment.
You are analyzing a set of elements selected by the user on the canvas.
Board Title: "${context.boardTitle}"
Selected Elements context (in JSON format):
${JSON.stringify(context.selectedElements, null, 2)}

Provide your response in clean, premium Markdown formatting. Focus on providing structural insights, design reviews, summaries, or engineering feedback depending on the requested action. Do not list raw IDs in your user-facing output unless describing components. Keep the tone professional, helpful, and concise.

`;
        let userPrompt = '';
        if (action === 'explain') {
            userPrompt = 'Please explain the selected elements, their relationships, and what they represent conceptually.';
        }
        else if (action === 'summarize') {
            userPrompt = 'Please summarize these ideas and elements concisely. Group key insights and outline high-level takeaways.';
        }
        else if (action === 'ask') {
            userPrompt = `User question: "${prompt}"`;
        }
        if (!apiKey) {
            const elementCount = context.selectedElements.length;
            const elementSummaries = context.selectedElements
                .map((el) => `- [${el.type}] "${el.text || 'Untitled object'}" (Color: ${el.color || 'none'})`)
                .join('\n');
            const mockMarkdown = `### AI Analysis Fallback (Key Missing)
⚠️ **API key \`GEMINI_API_KEY\` not found in backend environment.**

Configure a \`GEMINI_API_KEY\` in your \`backend/.env\` file to activate live Gemini generative models.

#### Selection Overview:
You selected **${elementCount} element(s)** on board **"${context.boardTitle}"**:
${elementSummaries}

#### Simulated Analysis (${action === 'explain' ? 'Explanation' : action === 'summarize' ? 'Summary' : 'Question Answer'}):
This is a simulated analysis of your canvas elements. The system detected shapes representing ${elementCount > 1 ? 'connected ideas' : 'a single idea'}. 
If you were to hook up an API key, the Gemini model would evaluate:
1. **Semantic connections** and architectural relationships between sticky notes.
2. **Detailed definitions** of technical nodes like caches, clients, and services.
3. **Optimizations** for reducing API latency and decoupling services.
`;
            res.json({ result: mockMarkdown });
            return;
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                        parts: [{
                                text: `${systemInstructions}\n${userPrompt}`
                            }]
                    }]
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            res.status(502).json({ error: `Gemini API returned error status ${response.status}: ${errorText}` });
            return;
        }
        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text generated.';
        res.json({ result: resultText });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create Socket.io server
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
const activePeers = new Map();
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // 1. Collaborative room assignment & join presence
    socket.on('join-board', ({ boardId, userId, displayName, avatar, presenceColor }) => {
        socket.join(boardId);
        const newPeer = {
            socketId: socket.id,
            userId,
            boardId,
            displayName,
            avatar,
            presenceColor,
            x: 0,
            y: 0,
            activeTool: 'select',
            activity: 'idle'
        };
        activePeers.set(socket.id, newPeer);
        console.log(`Socket ${socket.id} (${displayName}) joined room: ${boardId}`);
        // Notify others in room
        socket.to(boardId).emit('peer-join', newPeer);
        // Send list of all existing peers in this room back to the joiner
        const existing = Array.from(activePeers.values()).filter(p => p.boardId === boardId && p.socketId !== socket.id);
        socket.emit('peer-list', existing);
    });
    // 2. Element sync events
    socket.on('element-sync', (payload) => {
        socket.to(payload.boardId).emit('element-sync', payload);
    });
    // 3. User cursor movement
    socket.on('cursor-move', (payload) => {
        const peer = activePeers.get(socket.id);
        if (peer) {
            peer.x = payload.x;
            peer.y = payload.y;
            peer.activeTool = payload.activeTool;
            peer.activity = payload.activity;
            peer.selectedElementIds = payload.selectedElementIds;
            peer.editingElementId = payload.editingElementId;
        }
        socket.to(payload.boardId).emit('cursor-move', payload);
    });
    // 4. User active typing indicators
    socket.on('presence-typing', (payload) => {
        socket.to(payload.boardId).emit('presence-typing', payload);
    });
    // 5. Voting/Reaction event syncs
    socket.on('sticky-reaction', (payload) => {
        socket.to(payload.boardId).emit('sticky-reaction', payload);
    });
    // 6. Board restored checkpoint trigger
    socket.on('board-restored', (payload) => {
        socket.to(payload.boardId).emit('board-restored', payload);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const peer = activePeers.get(socket.id);
        if (peer) {
            socket.to(peer.boardId).emit('peer-leave', { userId: peer.userId });
            activePeers.delete(socket.id);
        }
    });
});
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
