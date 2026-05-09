/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  Orb,
  WORLD_SIZE,
  BASE_SPEED,
  BOOST_SPEED,
  TICK_RATE,
  MAX_ORBS,
  INITIAL_LENGTH,
  SEGMENT_SPACING,
  TURN_SPEED,
} from './src/shared/types.ts';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = 3000;

const COLORS = [
  '#ff7eb3', // vibrant pink
  '#ffb86c', // vibrant orange
  '#f1fa8c', // vibrant yellow
  '#50fa7b', // vibrant green
  '#8be9fd', // vibrant blue
  '#bd93f9', // vibrant purple
];

const state: GameState = {
  players: {},
  orbs: {},
  leaderboard: [],
};

function spawnOrb(x?: number, y?: number, value = 1, color?: string, force = false, type: OrbType = 'normal') {
  if (!force && Object.keys(state.orbs).length >= MAX_ORBS) return;
  const id = uuidv4();
  
  let finalType = type;
  if (!force && type === 'normal') {
    const rand = Math.random();
    if (rand < 0.05) finalType = 'speed';
    else if (rand < 0.1) finalType = 'magnet';
  }

  let finalColor = color;
  if (!finalColor) {
    if (finalType === 'speed') finalColor = '#ffffff'; // White for speed
    else if (finalType === 'magnet') finalColor = '#00ffff'; // Cyan for magnet
    else finalColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  state.orbs[id] = {
    id,
    x: x ?? (Math.random() - 0.5) * WORLD_SIZE,
    y: y ?? (Math.random() - 0.5) * WORLD_SIZE,
    value: finalType !== 'normal' ? 5 : value,
    color: finalColor,
    type: finalType,
  };
}

// Initial orbs
for (let i = 0; i < 150; i++) {
  spawnOrb();
}

let snakeCounter = 1;

function spawnBot() {
  const id = `bot-${uuidv4().slice(0, 8)}`;
  const name = `Bot-${snakeCounter++}`;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
  const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
  const angle = Math.random() * Math.PI * 2;

  const segments = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    segments.push({
      x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
      y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }

  state.players[id] = {
    id,
    name,
    color,
    segments,
    score: INITIAL_LENGTH,
    isBoosting: false,
    state: 'alive',
    currentAngle: angle,
    inputs: { left: false, right: false, boost: false },
  } as any; // Cast to bypass types if necessary
}

// Tick bot logic
function updateBots(delta: number) {
  const botIds = Object.keys(state.players).filter(id => id.startsWith('bot-'));
  
  // Maintain at least 5 players/bots
  const totalPlayers = Object.keys(state.players).length;
  if (totalPlayers < 10 && Math.random() < 0.01) {
    spawnBot();
  }

  botIds.forEach(id => {
    const bot = state.players[id];
    if (bot.state !== 'alive') return;

    // Very simple AI: target nearest orb
    let nearestOrb: Orb | null = null;
    let minDist = Infinity;
    for (const orbId in state.orbs) {
      const orb = state.orbs[orbId];
      const dx = orb.x - bot.segments[0].x;
      const dy = orb.y - bot.segments[0].y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearestOrb = orb;
      }
    }

    if (nearestOrb) {
      const targetAngle = Math.atan2(nearestOrb.y - bot.segments[0].y, nearestOrb.x - bot.segments[0].x);
      let diff = targetAngle - bot.currentAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      const turn = Math.sign(diff) * TURN_SPEED * delta * 0.5;
      bot.currentAngle += turn;
    } else {
      bot.currentAngle += (Math.random() - 0.5) * 0.5;
    }

    const speed = bot.isBoosting ? BOOST_SPEED : BASE_SPEED;
    const head = { ...bot.segments[0] };
    head.x += Math.cos(bot.currentAngle) * speed * delta;
    head.y += Math.sin(bot.currentAngle) * speed * delta;

    // Wrap around boundaries
    const halfSize = WORLD_SIZE / 2;
    if (head.x < -halfSize) head.x += WORLD_SIZE;
    if (head.x > halfSize) head.x -= WORLD_SIZE;
    if (head.y < -halfSize) head.y += WORLD_SIZE;
    if (head.y > halfSize) head.y -= WORLD_SIZE;

    bot.segments.unshift(head);
    const targetLength = Math.floor(bot.score);
    while (bot.segments.length > targetLength) {
      bot.segments.pop();
    }

    // Bot orb collection
    for (const orbId in state.orbs) {
      const orb = state.orbs[orbId];
      const dx = head.x - orb.x;
      const dy = head.y - orb.y;
      if (dx * dx + dy * dy < 4) {
        bot.score += orb.value;
        delete state.orbs[orbId];
      }
    }

    // Bot player collisions (simplified)
    let collided = false;
    for (const otherId in state.players) {
      if (otherId === id) continue;
      const other = state.players[otherId];
      if (other.state !== 'alive') continue;
      for (const seg of other.segments) {
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        if (dx * dx + dy * dy < 2.25) {
          collided = true;
          break;
        }
      }
      if (collided) break;
    }

    if (collided) {
      bot.state = 'dead';
      io.emit('kill', { victim: bot.name });
      // Drop orbs
      bot.segments.forEach((seg, i) => {
        if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, bot.color, true);
      });
      // Remove bot after a delay or immediately
      delete state.players[id];
    }
  });
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', () => {
    const name = `Snake-${snakeCounter++}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const angle = Math.random() * Math.PI * 2;

    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }

    state.players[socket.id] = {
      id: socket.id,
      name,
      color,
      segments,
      score: INITIAL_LENGTH,
      isBoosting: false,
      state: 'alive',
      currentAngle: angle,
      inputs: { left: false, right: false, boost: false },
    };

    socket.emit('init', socket.id);
  });

  socket.on('update_state', (data: { segments: any[], score: number, currentAngle: number, isBoosting: boolean, state: string }) => {
    const player = state.players[socket.id];
    if (player && player.state === 'alive') {
      player.segments = data.segments;
      player.score = data.score;
      player.currentAngle = data.currentAngle;
      player.isBoosting = data.isBoosting;
      
      if (data.state === 'dead') {
        player.state = 'dead';
        io.emit('kill', { victim: player.name });
        // Drop orbs
        player.segments.forEach((seg, i) => {
          if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, player.color, true);
        });
      }
    }
  });

  socket.on('collect_orb', (orbId: string) => {
    if (state.orbs[orbId]) {
      delete state.orbs[orbId];
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const player = state.players[socket.id];
    if (player && player.state === 'alive') {
      // Drop orbs
      player.segments.forEach((seg, i) => {
        if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, player.color, true);
      });
    }
    delete state.players[socket.id];
  });
});

// Game Loop
setInterval(() => {
  const delta = 1 / TICK_RATE;
  
  // Update bots
  updateBots(delta);

  // Update players (just for boosting orb drops)
  for (const id in state.players) {
    const player = state.players[id];
    if (player.state === 'alive' && player.isBoosting) {
      if (Math.random() < 0.1 && player.segments.length > 0) {
        const tail = player.segments[player.segments.length - 1];
        spawnOrb(tail.x, tail.y, 1, player.color, true);
      }
    }
  }

  // Spawn random orbs
  if (Math.random() < 0.2) {
    spawnOrb();
  }

  // Update leaderboard
  state.leaderboard = Object.values(state.players)
    .filter(p => p.state === 'alive')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), color: p.color }));

  // Broadcast state
  io.emit('state', state);

}, 1000 / TICK_RATE);

async function startServer() {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
