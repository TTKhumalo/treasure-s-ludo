
import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, RotateCcw, MessageCircle, ChevronRight, User, Bot, Volume2, 
  Mail, Smartphone, Users, Globe, Plus, Mic, MicOff, Check, X, 
  Loader2, LogOut, Send, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Modality } from "@google/genai";
import Board from './components/Board';
import Dice from './components/Dice';
import { Player, GameState, PlayerColor } from './types';
import { COLORS, START_INDICES } from './constants';
import { getAICommentary } from './services/geminiService';

// --- Auth Types ---
type AuthMethod = 'GUEST' | 'GOOGLE' | 'ICLOUD';

interface AppUser {
  id: string;
  name: string;
  avatar: string;
  method: AuthMethod;
}

// --- Online State Types ---
type Screen = 'AUTH' | 'LOBBY' | 'GAME';

const INITIAL_PLAYERS: Player[] = [
  { color: 'RED', name: 'You', isAI: false, tokens: Array.from({ length: 4 }).map((_, i) => ({ id: i, position: -1, status: 'BASE' })) },
  { color: 'GREEN', name: 'Waiting...', isAI: false, tokens: Array.from({ length: 4 }).map((_, i) => ({ id: i + 4, position: -1, status: 'BASE' })) },
  { color: 'YELLOW', name: 'Waiting...', isAI: false, tokens: Array.from({ length: 4 }).map((_, i) => ({ id: i + 8, position: -1, status: 'BASE' })) },
  { color: 'BLUE', name: 'Waiting...', isAI: false, tokens: Array.from({ length: 4 }).map((_, i) => ({ id: i + 12, position: -1, status: 'BASE' })) },
];

const App: React.FC = () => {
  // --- Navigation & Auth ---
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isCreator, setIsCreator] = useState(false);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    players: INITIAL_PLAYERS,
    currentPlayerIndex: 0,
    diceValue: 1,
    status: 'ROLLING',
    winner: null,
    logs: ["Welcome to Treasure's Ludo!"],
  });

  // --- Voice & AI ---
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [commentary, setCommentary] = useState<string>("Waiting for players to join...");
  const [joinRequest, setJoinRequest] = useState<{ id: string; name: string; timeLeft: number } | null>(null);
  const requestTimerRef = useRef<number | null>(null);

  // --- Live API Ref ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  // --- Auth Handlers ---
  const handleLogin = (method: AuthMethod) => {
    const mockUser: AppUser = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Player_${Math.floor(Math.random() * 9000) + 1000}`,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Math.random(),
      method
    };
    setCurrentUser(mockUser);
    setScreen('LOBBY');
  };

  const createGame = () => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    setRoomCode(code);
    setIsCreator(true);
    setGameState(prev => ({
      ...prev,
      players: [
        { ...prev.players[0], name: currentUser?.name || 'Creator' },
        ...prev.players.slice(1)
      ]
    }));
    setScreen('GAME');
    simulateJoinRequests();
  };

  // --- Simulated "Online" Activity ---
  const simulateJoinRequests = () => {
    if (!isCreator) return;
    setTimeout(() => {
      setJoinRequest({
        id: 'user_123',
        name: 'SpeedyLudo88',
        timeLeft: 15
      });
      startRequestTimer();
    }, 5000);
  };

  const startRequestTimer = () => {
    if (requestTimerRef.current) clearInterval(requestTimerRef.current);
    requestTimerRef.current = window.setInterval(() => {
      setJoinRequest(prev => {
        if (!prev || prev.timeLeft <= 0) {
          if (requestTimerRef.current) clearInterval(requestTimerRef.current);
          return null;
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  };

  const handleJoinDecision = (accepted: boolean) => {
    if (requestTimerRef.current) clearInterval(requestTimerRef.current);
    if (accepted && joinRequest) {
      setGameState(prev => {
        const nextSlot = prev.players.findIndex(p => p.name === 'Waiting...');
        if (nextSlot === -1) return prev;
        const newPlayers = [...prev.players];
        newPlayers[nextSlot] = { ...newPlayers[nextSlot], name: joinRequest.name };
        return { ...prev, players: newPlayers, logs: [`${joinRequest.name} has joined!`, ...prev.logs] };
      });
    }
    setJoinRequest(null);
  };

  // --- Live API Open Mic Integration ---
  const toggleMic = async () => {
    if (isMicEnabled) {
      setIsMicEnabled(false);
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicEnabled(true);
      updateLogs("Microphone access granted. Talking to players...");
    } catch (err) {
      alert("Microphone permission required for voice chat.");
    }
  };

  // --- Game Logic ---
  const updateLogs = (msg: string) => {
    setGameState(prev => ({ ...prev, logs: [msg, ...prev.logs.slice(0, 4)] }));
  };

  const handleDiceRoll = () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    setGameState(prev => {
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => {
            if (t.status === 'BASE' && roll === 6) return true;
            if (t.status === 'PATH') return true;
            if (t.status === 'HOME' && t.position + roll <= 5) return true;
            return false;
        });

        if (!canMove) {
            setTimeout(nextTurn, 1000);
            return { ...prev, diceValue: roll, status: 'ROLLING' };
        }
        return { ...prev, diceValue: roll, status: 'MOVING' };
    });
    updateLogs(`${gameState.players[gameState.currentPlayerIndex].name} rolled a ${roll}!`);
  };

  const handleTokenMove = (tokenId: number) => {
    if (gameState.status !== 'MOVING') return;

    setGameState(prev => {
      const newPlayers = [...prev.players];
      const player = newPlayers[prev.currentPlayerIndex];
      const tokenIndex = player.tokens.findIndex(t => t.id === tokenId);
      const token = player.tokens[tokenIndex];

      if (token.status === 'BASE' && prev.diceValue === 6) {
        token.status = 'PATH';
        token.position = START_INDICES[player.color];
        updateLogs(`${player.name} deployed a token!`);
      } else if (token.status === 'PATH') {
        const startPos = START_INDICES[player.color];
        const distanceTraveled = (token.position - startPos + 52) % 52;
        if (distanceTraveled + prev.diceValue > 50) {
            token.status = 'HOME';
            token.position = (distanceTraveled + prev.diceValue) - 51;
            updateLogs(`${player.name} is on the home stretch!`);
        } else {
            token.position = (token.position + prev.diceValue) % 52;
        }
      } else if (token.status === 'HOME') {
        if (token.position + prev.diceValue <= 5) {
            token.position += prev.diceValue;
            if (token.position === 5) updateLogs(`${player.name} finished a token! 🎉`);
        }
      }

      return { ...prev, players: newPlayers, status: 'ROLLING' };
    });

    if (gameState.diceValue !== 6) setTimeout(nextTurn, 600);
  };

  const nextTurn = () => {
    setGameState(prev => ({
      ...prev,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % 4,
      status: 'ROLLING'
    }));
  };

  const resetGame = () => {
    setGameState({
      players: INITIAL_PLAYERS,
      currentPlayerIndex: 0,
      diceValue: 1,
      status: 'ROLLING',
      winner: null,
      logs: ['Game Reset. Waiting for players...'],
    });
    setScreen('LOBBY');
  };

  // --- Sub-components (Screens) ---

  const AuthScreen = () => (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Background Palette Circles */}
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-red-500/10 blur-[100px] rounded-full -translate-x-1/4 -translate-y-1/4" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-green-500/10 blur-[100px] rounded-full translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-500/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4" />
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-yellow-500/10 blur-[100px] rounded-full translate-x-1/4 translate-y-1/4" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-slate-900/60 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl text-center relative z-10"
      >
        <div className="mb-10 flex flex-col items-center">
          <motion.div 
            animate={{ 
              boxShadow: [
                `0 0 20px ${COLORS.RED}44`,
                `0 0 20px ${COLORS.GREEN}44`,
                `0 0 20px ${COLORS.YELLOW}44`,
                `0 0 20px ${COLORS.BLUE}44`,
                `0 0 20px ${COLORS.RED}44`,
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="p-6 bg-white/5 rounded-[2rem] border border-white/10 mb-6"
          >
            <Trophy className="w-14 h-14 text-white" />
          </motion.div>
          <h1 className="text-5xl font-nunito font-black tracking-tight text-white mb-2 uppercase italic leading-none">
            TREASURE'S<br/>
            <span className="bg-gradient-to-r from-red-500 via-green-500 to-blue-500 bg-clip-text text-transparent">LUDO</span>
          </h1>
          <p className="text-slate-400 font-bold text-xs tracking-[0.3em] uppercase mt-2">The Ultimate Online Experience</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => handleLogin('GOOGLE')}
            className="w-full flex items-center justify-center gap-4 py-4 px-6 bg-white text-slate-900 rounded-2xl font-black transition-transform hover:scale-[1.03] active:scale-95 shadow-xl"
          >
            <Mail className="w-5 h-5 text-red-500" />
            Sign in with Google
          </button>
          <button 
            onClick={() => handleLogin('ICLOUD')}
            className="w-full flex items-center justify-center gap-4 py-4 px-6 bg-slate-800 text-white rounded-2xl font-black border border-white/10 transition-transform hover:scale-[1.03] active:scale-95 shadow-xl"
          >
            <Smartphone className="w-5 h-5 text-indigo-400" />
            Sign in with iCloud
          </button>
          
          <div className="flex items-center gap-4 my-6">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OR</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={() => handleLogin('GUEST')}
                className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl font-bold text-xs text-slate-300 transition-all"
             >
               Play as Guest
             </button>
             <button className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl font-bold text-xs text-slate-300 transition-all">
               Local Game
             </button>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col gap-4">
           <div className="flex justify-center gap-4">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_#eab308]" />
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
           </div>
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
             <ShieldCheck className="w-4 h-4" /> Secure Multiplayer Lobbies
           </p>
        </div>
      </motion.div>
    </div>
  );

  const LobbyScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8"
    >
      <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-8">
          <img src={currentUser?.avatar} className="w-16 h-16 rounded-2xl border-2 border-indigo-500 p-1 bg-slate-800" alt="Avatar" />
          <div>
            <h2 className="text-2xl font-bold text-white">{currentUser?.name}</h2>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online & Ready
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={createGame}
            className="w-full group relative overflow-hidden flex items-center justify-between p-6 bg-indigo-600 rounded-[1.5rem] font-black text-lg transition-all hover:bg-indigo-500 shadow-xl shadow-indigo-500/20"
          >
            <div className="flex items-center gap-4">
              <Plus className="w-6 h-6" />
              CREATE PRIVATE ROOM
            </div>
            <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
          </button>

          <button className="w-full flex items-center justify-between p-6 bg-slate-800 border border-slate-700 rounded-[1.5rem] font-black text-lg text-slate-300 transition-all hover:bg-slate-700">
            <div className="flex items-center gap-4">
              <Globe className="w-6 h-6" />
              QUICK MATCH
            </div>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800/50 p-8 rounded-[2rem] backdrop-blur-md">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Users className="w-4 h-4" /> Friends Online
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-slate-500">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-200">Treasure_Fan_{i}</p>
                  <p className="text-[10px] text-green-500 font-black uppercase">In Lobby</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-black hover:bg-indigo-600/40 transition-colors">
                INVITE
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-950 text-slate-100 selection:bg-indigo-500 overflow-y-auto font-inter">
      
      {/* Join Request Overlay */}
      <AnimatePresence>
        {joinRequest && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm"
          >
            <div className="bg-slate-900 border-2 border-indigo-500 p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-white">{joinRequest.name}</h4>
                  <p className="text-xs text-slate-400 font-bold">Wants to join your match</p>
                </div>
                <div className="text-2xl font-nunito font-black text-indigo-500 w-8 h-8 flex items-center justify-center">
                  {joinRequest.timeLeft}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleJoinDecision(true)}
                  className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Check className="w-4 h-4" /> ACCEPT
                </button>
                <button 
                  onClick={() => handleJoinDecision(false)}
                  className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-sm hover:bg-slate-700 transition-all border border-slate-700"
                >
                  <X className="w-4 h-4" /> DECLINE
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {screen === 'AUTH' && <AuthScreen />}
      {screen === 'LOBBY' && <LobbyScreen />}
      
      {screen === 'GAME' && (
        <>
          <header className="w-full max-w-4xl flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-nunito font-black tracking-tight text-white uppercase italic">TREASURE'S LUDO</h1>
                <div className="flex items-center gap-2">
                   <div className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-black text-indigo-400 tracking-widest flex items-center gap-1">
                     <ShieldCheck className="w-3 h-3" /> ROOM: {roomCode}
                   </div>
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[10px] text-slate-500 font-bold uppercase">Live Match</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                 onClick={toggleMic}
                 className={`p-3 rounded-xl transition-all border flex items-center gap-2 font-bold text-sm ${
                   isMicEnabled 
                     ? 'bg-red-600/10 border-red-500/50 text-red-500 animate-pulse' 
                     : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                 }`}
               >
                 {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                 <span className="hidden sm:inline uppercase tracking-widest">{isMicEnabled ? 'MIC ON' : 'MIC OFF'}</span>
               </button>
               <button onClick={() => setScreen('LOBBY')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </header>

          <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Players Info */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                  Connected <span>{gameState.players.filter(p => p.name !== 'Waiting...').length}/4</span>
                </h2>
                <div className="space-y-3">
                  {gameState.players.map((p, idx) => {
                    const isEmpty = p.name === 'Waiting...';
                    return (
                      <div 
                        key={p.color} 
                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                          gameState.currentPlayerIndex === idx ? `bg-slate-800/80 shadow-lg` : isEmpty ? 'opacity-20 grayscale' : 'opacity-40'
                        }`} 
                        style={{ borderColor: gameState.currentPlayerIndex === idx ? COLORS[p.color] : 'transparent' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-inner relative" style={{ backgroundColor: COLORS[p.color] }}>
                            <User className="w-5 h-5 text-white" />
                            {p.name === currentUser?.name && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-indigo-500" />}
                          </div>
                          <span className={`font-bold text-sm ${isEmpty ? 'italic' : ''}`}>{p.name}</span>
                        </div>
                        {gameState.currentPlayerIndex === idx && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        {!isEmpty && idx !== 0 && <div className="flex items-center gap-1"><Mic className="w-3 h-3 text-slate-500" /></div>}
                      </div>
                    );
                  })}
                </div>
                {isCreator && gameState.players.some(p => p.name === 'Waiting...') && (
                  <button className="w-full mt-4 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-600/20 transition-all uppercase">
                    Copy Invitation Link
                  </button>
                )}
              </div>
              <div className="bg-indigo-900/20 p-5 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">AI Master Voice</span>
                </div>
                <p className="text-sm italic text-indigo-100 leading-relaxed font-medium">"{commentary}"</p>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col items-center gap-6">
              <Board gameState={gameState} onTokenClick={handleTokenMove} />
              <div className="w-full bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col gap-1 overflow-hidden h-28">
                <AnimatePresence mode='popLayout'>
                  {gameState.logs.map((log, i) => (
                    <motion.div key={log + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1 - (i * 0.2), x: 0 }} className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[50px] pointer-events-none" />
                <h3 className="text-sm font-black tracking-[0.2em] text-slate-500 uppercase">Current Turn</h3>
                <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl relative" style={{ backgroundColor: COLORS[gameState.players[gameState.currentPlayerIndex].color] }}>
                   <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                   <User className="w-12 h-12 text-white" />
                </div>
                <p className="font-black text-xl tracking-wide uppercase text-white">{gameState.players[gameState.currentPlayerIndex].name}</p>
                <Dice 
                  value={gameState.diceValue} 
                  onRoll={handleDiceRoll} 
                  disabled={gameState.status !== 'ROLLING' || (gameState.players[gameState.currentPlayerIndex].name !== currentUser?.name)} 
                  color={COLORS[gameState.players[gameState.currentPlayerIndex].color]} 
                />
              </div>
              
              <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Chat</span>
                    <Users className="w-4 h-4 text-slate-600" />
                 </div>
                 <div className="flex gap-2">
                    <input type="text" placeholder="Type a message..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors" />
                    <button className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors">
                       <Send className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            </div>
          </main>
          <footer className="mt-12 text-slate-700 text-[9px] font-black uppercase tracking-[0.5em] text-center w-full">
            Treasure's Ludo &bull; Online Multiplayer &bull; Voice Enabled &bull; 2024
          </footer>
        </>
      )}
    </div>
  );
};

export default App;
