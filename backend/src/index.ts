import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, run } from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Express REST API endpoints

// 1. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'SyncSketch backend is operational' });
});

// 2. Fetch Board Library list (Search and sorting supported)
app.get('/api/boards', async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    const sort = (req.query.sort as string) || 'recently_edited';

    let orderClause = 'updated_at DESC';
    if (sort === 'recently_created') {
      orderClause = 'created_at DESC';
    } else if (sort === 'alphabetical') {
      orderClause = 'title ASC';
    }

    const boards = await query(
      `SELECT * FROM boards WHERE title LIKE ? ORDER BY ${orderClause}`,
      [`%${search}%`]
    );
    res.json(boards);
  } catch (err: any) {
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

    await run(
      'INSERT INTO boards (id, title, favorite, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
      [boardId, boardTitle, now, now]
    );

    res.status(201).json({ id: boardId, title: boardTitle, favorite: 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Retrieve single Board elements
app.get('/api/boards/:id', async (req, res) => {
  try {
    const boardId = req.params.id;
    
    // Check if board exists
    const boards = await query('SELECT * FROM boards WHERE id = ?', [boardId]);
    if (boards.length === 0) {
      // Create board on the fly if requested
      const now = Date.now();
      await run(
        'INSERT INTO boards (id, title, favorite, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
        [boardId, 'Untitled Board', now, now]
      );
      res.json({ id: boardId, title: 'Untitled Board', favorite: 0, elements: [] });
      return;
    }

    const elementsRaw = await query('SELECT data FROM board_elements WHERE board_id = ?', [boardId]);
    const elements = elementsRaw.map((row: any) => JSON.parse(row.data));
    
    res.json({
      ...boards[0],
      elements
    });
  } catch (err: any) {
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
      await run(
        'UPDATE boards SET title = ?, favorite = ?, updated_at = ? WHERE id = ?',
        [title, favorite, now, boardId]
      );
    } else if (title !== undefined) {
      await run(
        'UPDATE boards SET title = ?, updated_at = ? WHERE id = ?',
        [title, now, boardId]
      );
    } else if (favorite !== undefined) {
      await run(
        'UPDATE boards SET favorite = ?, updated_at = ? WHERE id = ?',
        [favorite, now, boardId]
      );
    } else {
      await run(
        'UPDATE boards SET updated_at = ? WHERE id = ?',
        [now, boardId]
      );
    }

    // 2. Save Elements
    if (elements && Array.isArray(elements)) {
      await run('DELETE FROM board_elements WHERE board_id = ?', [boardId]);
      for (const el of elements) {
        await run(
          'INSERT OR REPLACE INTO board_elements (id, board_id, data) VALUES (?, ?, ?)',
          [el.id, boardId, JSON.stringify(el)]
        );
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete a Board
app.delete('/api/boards/:id', async (req, res) => {
  try {
    const boardId = req.params.id;
    await run('DELETE FROM boards WHERE id = ?', [boardId]);
    await run('DELETE FROM board_elements WHERE board_id = ?', [boardId]);
    await run('DELETE FROM board_versions WHERE board_id = ?', [boardId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Fetch Board version snapshot history
app.get('/api/boards/:id/versions', async (req, res) => {
  try {
    const boardId = req.params.id;
    const versions = await query(
      'SELECT id, name, is_autosave, created_at FROM board_versions WHERE board_id = ? ORDER BY created_at DESC',
      [boardId]
    );
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Fetch elements of a specific historical version
app.get('/api/boards/:id/versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const versions = await query('SELECT data FROM board_versions WHERE id = ?', [versionId]);
    if (versions.length === 0) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json({ elements: JSON.parse(versions[0].data) });
  } catch (err: any) {
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

    await run(
      'INSERT INTO board_versions (id, board_id, name, data, is_autosave, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [versionId, boardId, name || 'Autosave', JSON.stringify(elements), isAutosave ? 1 : 0, now]
    );

    // Keep version count capped per board to avoid infinite database growth
    const countRow = await query('SELECT COUNT(*) as cnt FROM board_versions WHERE board_id = ?', [boardId]);
    if (countRow[0].cnt > 30) {
      const oldest = await query(
        'SELECT id FROM board_versions WHERE board_id = ? ORDER BY created_at ASC LIMIT 1',
        [boardId]
      );
      if (oldest.length > 0) {
        await run('DELETE FROM board_versions WHERE id = ?', [oldest[0].id]);
      }
    }

    res.status(201).json({ id: versionId, name, created_at: now });
  } catch (err: any) {
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
    } else if (action === 'summarize') {
      userPrompt = 'Please summarize these ideas and elements concisely. Group key insights and outline high-level takeaways.';
    } else if (action === 'ask') {
      userPrompt = `User question: "${prompt}"`;
    }

    if (!apiKey) {
      const elementCount = context.selectedElements.length;
      const elementSummaries = context.selectedElements
        .map((el: any) => `- [${el.type}] "${el.text || 'Untitled object'}" (Color: ${el.color || 'none'})`)
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

    const data: any = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text generated.';
    res.json({ result: resultText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. AI Generative Canvas Builder
app.post('/api/ai/generate-canvas', async (req, res) => {
  try {
    const { prompt, action, boardTitle, startX = 200, startY = 200 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const now = Date.now();
    const baseId = Math.random().toString(36).substring(2, 7);

    // Fallback procedural elements generator based on topic/action
    const getProceduralElements = (promptText: string, actionType: string) => {
      const lower = (promptText + ' ' + actionType).toLowerCase();
      const generated: any[] = [];

      const imageKeywords = ['dolphin', 'cat', 'dog', 'cyberpunk', 'landscape', 'astronaut', 'pixar', 'anime', 'watercolor', 'portrait', 'illustration', 'render', 'logo', 'sticker', 'generate a ', 'image of', 'picture of', 'photo of'];
      if (imageKeywords.some(kw => lower.includes(kw))) {
        const cleanPrompt = encodeURIComponent(`${promptText}, high quality, masterpiece, 8k resolution`);
        const imgUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=600&height=400&seed=${Math.floor(Math.random() * 999999)}&nologo=true`;
        
        generated.push({
          id: `img_gen_${baseId}`,
          type: 'image',
          src: imgUrl,
          alt: promptText,
          x: startX,
          y: startY,
          width: 500,
          height: 350,
          opacity: 1,
          rotation: 0,
          stroke: 'transparent',
          strokeWidth: 1,
          fill: 'transparent',
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });
        return generated;
      }

      if (lower.includes('aws') || lower.includes('architecture') || lower.includes('cloud')) {
        // AWS Architecture Diagram Template
        const frameId = `frame_${baseId}_aws`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `☁️ AWS Cloud Architecture: ${promptText || 'Serverless System'}`,
          x: startX,
          y: startY,
          width: 1050,
          height: 600,
          stroke: '#f97316',
          strokeWidth: 2,
          fill: '#fff7ed',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 1. Internet Gateway / Client
        const igwId = `rect_${baseId}_igw`;
        generated.push({
          id: igwId,
          type: 'rectangle',
          text: '🌐 Client / Internet Gateway',
          x: startX + 50,
          y: startY + 250,
          width: 180,
          height: 90,
          stroke: '#3b82f6',
          strokeWidth: 2,
          fill: '#dbeafe',
          fontSize: 13,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 2. Application Load Balancer
        const albId = `rect_${baseId}_alb`;
        generated.push({
          id: albId,
          type: 'rectangle',
          text: '⚖️ AWS ALB / API Gateway',
          x: startX + 280,
          y: startY + 250,
          width: 190,
          height: 90,
          stroke: '#8b5cf6',
          strokeWidth: 2,
          fill: '#ede9fe',
          fontSize: 13,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 3. EC2 / Lambda Compute Cluster
        const ec2Id = `rect_${baseId}_ec2`;
        generated.push({
          id: ec2Id,
          type: 'rectangle',
          text: '⚡ EC2 Compute Cluster / Lambda',
          x: startX + 530,
          y: startY + 150,
          width: 210,
          height: 100,
          stroke: '#f97316',
          strokeWidth: 2,
          fill: '#ffedd5',
          fontSize: 13,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 4. RDS Database
        const rdsId = `rect_${baseId}_rds`;
        generated.push({
          id: rdsId,
          type: 'rectangle',
          text: '🛢️ Amazon RDS (PostgreSQL)',
          x: startX + 530,
          y: startY + 330,
          width: 210,
          height: 100,
          stroke: '#10b981',
          strokeWidth: 2,
          fill: '#d1fae5',
          fontSize: 13,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 5. S3 Bucket
        const s3Id = `rect_${baseId}_s3`;
        generated.push({
          id: s3Id,
          type: 'rectangle',
          text: '📦 Amazon S3 Storage Bucket',
          x: startX + 800,
          y: startY + 250,
          width: 190,
          height: 90,
          stroke: '#ec4899',
          strokeWidth: 2,
          fill: '#fce7f3',
          fontSize: 13,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // Connectors
        [
          { from: igwId, to: albId },
          { from: albId, to: ec2Id },
          { from: albId, to: rdsId },
          { from: ec2Id, to: s3Id }
        ].forEach((link, idx) => {
          generated.push({
            id: `conn_aws_${baseId}_${idx}`,
            type: 'connector',
            fromId: link.from,
            toId: link.to,
            fromPort: 'right',
            toPort: 'left',
            routingStyle: 'elbow',
            isAnimated: true,
            stroke: '#ea580c',
            strokeWidth: 2,
            fill: 'transparent',
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now
          });
        });

      } else if (lower.includes('er') || lower.includes('database') || lower.includes('schema')) {
        // ER Diagram Schema
        const frameId = `frame_${baseId}_er`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `🛢️ Database ER Schema: ${promptText || 'App Database'}`,
          x: startX,
          y: startY,
          width: 1000,
          height: 600,
          stroke: '#0284c7',
          strokeWidth: 2,
          fill: '#f0f9ff',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        const tables = [
          { name: 'USERS', fields: ['🔑 id (PK)', '👤 email (STRING)', '🔒 password_hash', '📅 created_at'], x: startX + 50, y: startY + 100 },
          { name: 'ORDERS', fields: ['🔑 id (PK)', '🔗 user_id (FK)', '💰 total_amount', '🚚 status (ENUM)'], x: startX + 380, y: startY + 100 },
          { name: 'PRODUCTS', fields: ['🔑 id (PK)', '🏷️ title (STRING)', '💵 price (NUMERIC)', '📦 stock_qty'], x: startX + 700, y: startY + 100 }
        ];

        tables.forEach((tbl, idx) => {
          generated.push({
            id: `tbl_er_${baseId}_${idx}`,
            type: 'table',
            rows: 5,
            cols: 1,
            cellsData: [[tbl.name], ...tbl.fields.map(f => [f])],
            x: tbl.x,
            y: tbl.y,
            width: 240,
            height: 240,
            stroke: '#0284c7',
            strokeWidth: 2,
            fill: '#ffffff',
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now
          });
        });

        // Connector USERS -> ORDERS
        generated.push({
          id: `conn_er_${baseId}_1`,
          type: 'connector',
          fromId: `tbl_er_${baseId}_0`,
          toId: `tbl_er_${baseId}_1`,
          fromPort: 'right',
          toPort: 'left',
          routingStyle: 'elbow',
          isAnimated: true,
          stroke: '#0284c7',
          strokeWidth: 2,
          fill: 'transparent',
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

      } else if (lower.includes('wireframe') || lower.includes('ui') || lower.includes('interface')) {
        // UI Wireframe
        const frameId = `frame_${baseId}_ui`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `🖥️ UI Wireframe: ${promptText || 'App Interface'}`,
          x: startX,
          y: startY,
          width: 900,
          height: 650,
          stroke: '#64748b',
          strokeWidth: 2,
          fill: '#ffffff',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // Navbar
        generated.push({
          id: `rect_ui_nav_${baseId}`,
          type: 'rectangle',
          text: 'SYNCSKETCH   |   Home    Products    About    [ Login ]',
          x: startX + 30,
          y: startY + 50,
          width: 840,
          height: 50,
          stroke: '#94a3b8',
          strokeWidth: 1,
          fill: '#f1f5f9',
          fontSize: 13,
          align: 'left',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // Hero Banner
        generated.push({
          id: `rect_ui_hero_${baseId}`,
          type: 'rectangle',
          text: 'Hero Banner Title\n\nBuild Amazing Visual Collaborative Whiteboards Today.\n[ Get Started Free ]',
          x: startX + 30,
          y: startY + 120,
          width: 840,
          height: 180,
          stroke: '#cbd5e1',
          strokeWidth: 1,
          fill: '#e2e8f0',
          fontSize: 14,
          align: 'center',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        // 3 Feature Cards
        [0, 1, 2].forEach((cIdx) => {
          generated.push({
            id: `rect_ui_card_${baseId}_${cIdx}`,
            type: 'rectangle',
            text: `Feature Card #${cIdx + 1}\n\nInteractive canvas widgets, AI assistants, and realtime sync.`,
            x: startX + 30 + cIdx * 285,
            y: startY + 320,
            width: 270,
            height: 200,
            stroke: '#cbd5e1',
            strokeWidth: 1,
            fill: '#f8fafc',
            fontSize: 13,
            align: 'center',
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now
          });
        });

      } else if (lower.includes('journey') || lower.includes('map user')) {
        // User Journey Map Template
        const frameId = `frame_${baseId}_ujm`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `🗺️ User Journey Map: ${promptText || 'Customer Checkout'}`,
          x: startX,
          y: startY,
          width: 1200,
          height: 650,
          stroke: '#3b82f6',
          strokeWidth: 2,
          fill: '#f8fafc',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        const stages = [
          { name: '1. Discovery & Awareness', color: '#bfdbfe', items: ['Social Media Ad', 'Google Search', 'Friend Recommendation'] },
          { name: '2. Consideration & Evaluation', color: '#fef08a', items: ['Compare Product Features', 'Read Customer Reviews', 'Check Price'] },
          { name: '3. Purchase & Checkout', color: '#bbf7d0', items: ['Add to Cart', 'Enter Shipping Address', 'Complete Payment'] },
          { name: '4. Onboarding & Loyalty', color: '#fbcfe8', items: ['Receive Email Receipt', 'Unbox Package', 'Leave Review'] }
        ];

        stages.forEach((stg, idx) => {
          const colX = startX + 40 + idx * 275;
          const colY = startY + 60;

          generated.push({
            id: `text_ujm_hdr_${baseId}_${idx}`,
            type: 'text',
            text: stg.name,
            x: colX,
            y: colY,
            width: 250,
            height: 30,
            fontSize: 15,
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            fontStyle: 'normal',
            align: 'left',
            stroke: '#1e293b',
            strokeWidth: 1,
            fill: 'transparent',
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now
          });

          stg.items.forEach((item, itemIdx) => {
            const stickyId = `stk_ujm_${baseId}_${idx}_${itemIdx}`;
            generated.push({
              id: stickyId,
              type: 'sticky',
              text: item,
              x: colX,
              y: colY + 45 + itemIdx * 155,
              width: 250,
              height: 135,
              fontSize: 14,
              fontFamily: 'sans-serif',
              align: 'left',
              stickyColor: stg.color,
              stroke: 'transparent',
              strokeWidth: 1,
              fill: stg.color,
              opacity: 1,
              rotation: 0,
              isLocked: false,
              createdBy: 'ai',
              createdAt: now,
              updatedAt: now,
              cardStyle: 'rounded'
            });

            // Add connector to next stage item
            if (idx < stages.length - 1 && itemIdx === 0) {
              const nextId = `stk_ujm_${baseId}_${idx + 1}_0`;
              generated.push({
                id: `conn_ujm_${baseId}_${idx}`,
                type: 'connector',
                fromId: stickyId,
                toId: nextId,
                fromPort: 'right',
                toPort: 'left',
                routingStyle: 'elbow',
                isAnimated: true,
                stroke: '#64748b',
                strokeWidth: 2,
                fill: 'transparent',
                isLocked: false,
                createdBy: 'ai',
                createdAt: now,
                updatedAt: now
              });
            }
          });
        });
      } else if (lower.includes('roadmap') || lower.includes('plan')) {
        // Product Roadmap Template
        const frameId = `frame_${baseId}_rdm`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `📅 Product Roadmap: ${promptText || 'Q3 - Q4 Objectives'}`,
          x: startX,
          y: startY,
          width: 1100,
          height: 600,
          stroke: '#a855f7',
          strokeWidth: 2,
          fill: '#faf5ff',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        const quarters = [
          { q: 'Q1: Foundation', color: '#fed7aa', tasks: ['User Auth & Security', 'Database Scaling', 'CI/CD Pipeline'] },
          { q: 'Q2: Growth Features', color: '#bfdbfe', tasks: ['Realtime Socket Sync', 'Version History', 'AI Assistant Modal'] },
          { q: 'Q3: Expansion', color: '#bbf7d0', tasks: ['Mobile Native App', 'Enterprise SSO', 'Custom Plugins'] }
        ];

        quarters.forEach((q, qIdx) => {
          const qX = startX + 40 + qIdx * 340;
          const qY = startY + 60;

          generated.push({
            id: `text_rdm_${baseId}_${qIdx}`,
            type: 'text',
            text: q.q,
            x: qX,
            y: qY,
            width: 300,
            height: 30,
            fontSize: 16,
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            fontStyle: 'normal',
            align: 'left',
            stroke: '#581c87',
            strokeWidth: 1,
            fill: 'transparent',
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now
          });

          q.tasks.forEach((tsk, tIdx) => {
            generated.push({
              id: `sticky_rdm_${baseId}_${qIdx}_${tIdx}`,
              type: 'sticky',
              text: tsk,
              x: qX,
              y: qY + 45 + tIdx * 155,
              width: 300,
              height: 135,
              fontSize: 14,
              fontFamily: 'sans-serif',
              align: 'left',
              stickyColor: q.color,
              stroke: 'transparent',
              strokeWidth: 1,
              fill: q.color,
              opacity: 1,
              rotation: 0,
              isLocked: false,
              createdBy: 'ai',
              createdAt: now,
              updatedAt: now,
              cardStyle: 'rounded'
            });
          });
        });
      } else {
        // Default Brainstorming Idea Cluster
        const frameId = `frame_${baseId}_bs`;
        generated.push({
          id: frameId,
          type: 'frame',
          title: `💡 AI Brainstorming: ${promptText || 'Creative Ideas'}`,
          x: startX,
          y: startY,
          width: 950,
          height: 600,
          stroke: '#22c55e',
          strokeWidth: 2,
          fill: '#f0fdf4',
          opacity: 1,
          rotation: 0,
          isLocked: false,
          createdBy: 'ai',
          createdAt: now,
          updatedAt: now
        });

        const ideaColors = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#e9d5ff'];
        const sampleIdeas = [
          `Core Concept: ${promptText || 'Innovative Solution'}`,
          'User Engagement Gamification',
          'Automated Workflow Triggers',
          'Multi-channel Notification System',
          'Interactive Data Analytics Dashboard',
          'AI-Powered Recommendation Engine'
        ];

        sampleIdeas.forEach((idea, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          const stickyX = startX + 50 + col * 280;
          const stickyY = startY + 80 + row * 220;

          generated.push({
            id: `sticky_bs_${baseId}_${idx}`,
            type: 'sticky',
            text: idea,
            x: stickyX,
            y: stickyY,
            width: 250,
            height: 180,
            fontSize: 15,
            fontFamily: 'sans-serif',
            align: 'center',
            stickyColor: ideaColors[idx % ideaColors.length],
            stroke: 'transparent',
            strokeWidth: 1,
            fill: ideaColors[idx % ideaColors.length],
            opacity: 1,
            rotation: 0,
            isLocked: false,
            createdBy: 'ai',
            createdAt: now,
            updatedAt: now,
            cardStyle: 'rounded'
          });
        });
      }

      return generated;
    };

    const elementsToReturn = getProceduralElements(prompt || 'New Canvas Idea', action || '');
    res.json({ elements: elementsToReturn });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. AI Generative Image Builder Pipeline
app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'photorealistic', width = 600, height = 400 } = req.body;
    const cleanPrompt = encodeURIComponent(`${prompt}, ${style} style, masterpiece, high detail, 8k resolution`);
    // Pollinations AI real-time generative diffusion model API
    const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${Math.floor(Math.random() * 999999)}&nologo=true`;
    
    res.json({
      success: true,
      imageUrl,
      prompt,
      style,
      width,
      height
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. AI Providers Status Check Endpoint
app.get('/api/ai/providers', (req, res) => {
  res.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    imageProvider: 'pollinations',
    activeProvider: process.env.GEMINI_API_KEY ? 'Google Gemini 1.5 Flash' : 'Procedural AI Engine'
  });
});

// Create Socket.io server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface Peer {
  socketId: string;
  userId: string;
  boardId: string;
  displayName: string;
  avatar: string;
  presenceColor: string;
  x: number;
  y: number;
  activeTool: string;
  activity: string;
  selectedElementIds?: string[];
  editingElementId?: string;
}

const activePeers = new Map<string, Peer>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 1. Collaborative room assignment & join presence
  socket.on('join-board', ({ boardId, userId, displayName, avatar, presenceColor }) => {
    socket.join(boardId);
    
    const newPeer: Peer = {
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
