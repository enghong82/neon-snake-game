/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, Map as MapIcon } from 'lucide-react';
import { WORLD_SIZE } from '../shared/types';

export function UI() {
  const { gameState, playerId, joinGame, notifications } = useGameStore();

  const player = playerId && gameState ? gameState.players[playerId] : null;
  const isAlive = player?.state === 'alive';
  const isDead = player?.state === 'dead';

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const minimapScale = 120 / WORLD_SIZE;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* ... (Top Bar and Leaderboard stay similar, I'll update the whole return) */}
      <div className="flex justify-between items-start pointer-events-auto relative">
        <div className="flex flex-col gap-2 z-10">
          <h1 className="text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
            NEON.SNAKE
          </h1>
          {isAlive && (
            <div className="text-xl font-mono text-white/80 font-bold">
              Length: {Math.floor(player.score)}
            </div>
          )}

          {/* Notifications */}
          <div className="flex flex-col gap-1 mt-4">
            <AnimatePresence>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-red-500/20 border border-red-500/30 text-red-200 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-sm backdrop-blur-sm"
                >
                  {n.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Controls Hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex gap-2 opacity-80 pointer-events-none hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">A</span>
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">D</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Turn</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">SPACE</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Boost</span>
          </div>
        </div>

        <button
          onClick={handleOpenNewTab}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors z-10"
        >
          <ExternalLink size={16} />
          <span>New Tab</span>
        </button>
      </div>

      {/* Leaderboard */}
      {gameState && gameState.leaderboard.length > 0 && (
        <div className="absolute top-20 right-4 w-64 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-2 mb-4 text-white/80 font-semibold">
            <Trophy size={18} className="text-yellow-400" />
            <h2>LEADERBOARD</h2>
          </div>
          <div className="flex flex-col gap-2">
            {gameState.leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-white/40 w-4">{i + 1}.</span>
                  <span style={{ color: entry.color }} className="font-medium truncate max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono text-white/80">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minimap */}
      {isAlive && gameState && (
        <div className="absolute bottom-4 right-4 w-[120px] h-[120px] bg-black/40 backdrop-blur-md rounded-xl border border-white/10 pointer-events-auto overflow-hidden">
          <div className="relative w-full h-full">
            {/* World Grid Hint */}
            <div className="absolute inset-0 border border-white/5 grid grid-cols-4 grid-rows-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="border border-white/5" />
              ))}
            </div>

            {/* Other Snakes */}
            {Object.values(gameState.players).map((p) => {
              if (p.state !== 'alive' || p.id === playerId || p.segments.length === 0) return null;
              const head = p.segments[0];
              return (
                <div
                  key={p.id}
                  className="absolute w-1 h-1 rounded-full shadow-[0_0_4px_currentColor]"
                  style={{
                    color: p.color,
                    backgroundColor: p.color,
                    left: `${(head.x / WORLD_SIZE + 0.5) * 100}%`,
                    top: `${(0.5 - head.y / WORLD_SIZE) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}

            {/* Local Player */}
            {player && (
              <div
                className="absolute w-1.5 h-1.5 rounded-full bg-white z-10 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{
                  left: `${(player.segments[0].x / WORLD_SIZE + 0.5) * 100}%`,
                  top: `${(0.5 - player.segments[0].y / WORLD_SIZE) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {(!player || isDead) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm shadow-[inset_0_0_100px_rgba(0,0,0,1)]"
          >
            <div className="bg-zinc-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Trophy className={isDead ? "text-red-500" : "text-blue-500"} size={32} />
              </div>

              {isDead && (
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">WRECKED.</h2>
                  <p className="text-white/40 font-mono text-sm uppercase tracking-widest">Score: {Math.floor(player.score)}</p>
                </div>
              )}
              
              {!isDead && (
                <div className="text-center">
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">ARENA</h2>
                  <p className="text-white/40 text-sm">Eat orbs, get long, don't crash.</p>
                </div>
              )}
              
              <button
                onClick={joinGame}
                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
              >
                {isDead ? 'RESPAWN' : 'ENTER GRID'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
