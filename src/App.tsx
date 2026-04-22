/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Play, RotateCcw, Heart, Trophy, Medal, Star, Crown, Bolt, Satellite } from 'lucide-react';

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Constants & Types ---

const WORD_POOLS = {
  EASY: [
    "HAPPY", "SAD", "BIG", "SMALL", "FAST", "SLOW", "GOOD", "BAD", "HOT", "COLD", 
    "LOUD", "QUIET", "NEW", "OLD", "EASY", "HARD", "BRIGHT", "DARK", "SMART", "FUNNY", 
    "ANGRY", "BRAVE", "CLEAN", "DIRTY", "EARLY", "LATE", "FULL", "EMPTY", "GENTLE", "ROUGH", 
    "HEAVY", "LIGHT", "KIND", "CRUEL", "LOVELY", "UGLY", "NEAR", "FAR", "RICH", "POOR", 
    "STRONG", "WEAK", "SWEET", "SOUR", "TALL", "SHORT", "THICK", "THIN", "TRUE", "FALSE", 
    "WET", "DRY", "YOUNG", "AWAKE", "ASLEEP", "BEGIN", "FINISH", "BUY", "SELL", "LOVE", 
    "HATE", "PUSH", "PULL", "LAUGH", "CRY", "OPEN", "CLOSE", "SMILE", "FROWN", "STAY", 
    "GO", "UP", "DOWN", "LEFT", "RIGHT", "NORTH", "SOUTH", "EAST", "WEST", "WIN", "LOSE"
  ],
  MEDIUM: [
    "ABUNDANT", "ACCELERATE", "ACCURATE", "ADAPT", "ADEQUATE", "AMBITIOUS", "ANALYZE", "ANTICIPATE", "APPARENT", "APPROACH", 
    "ASCERTAIN", "ASSERT", "BENEVOLENT", "CANDID", "CATALYST", "CEASE", "CLANDESTINE", "COERCE", "COHERENT", "COMPASSION", 
    "COMPEL", "CONCISE", "CONCUR", "CONDEMN", "CONSENSUS", "CONSPICUOUS", "CONTEMPLATE", "CONTRADICT", "COPIOUS", "CORROBORATE", 
    "CRITICAL", "CULTIVATE", "DEARTH", "DECEIVE", "DEDUCE", "DEFEND", "DEFICIENT", "DELIBERATE", "DEPLETE", "DESPICABLE", 
    "DETER", "DEVIATE", "DILIGENT", "DIMINISH", "DISCERN", "DISCLOSE", "DISMAL", "DISPERSE", "DISPUTE", "DISRUPT", 
    "DUBIOUS", "ECCENTRIC", "ELOQUENT", "ELUCIDATE", "ELUSIVE", "EMINENT", "EMPATHY", "ENDURE", "ENHANCE", "ENIGMA", 
    "ENORMOUS", "EPHEMERAL", "ERADICATE", "ERRATIC", "ESCALATE", "ESTEEM", "EVADE", "EXACERBATE", "EXAMINE", "EXCEED", 
    "EXEMPLIFY", "EXHAUST", "EXHIBIT", "EXPAND", "EXPEDITE", "EXPLICIT", "EXPLOIT", "EXTENSIVE", "EXTRACT", "FABRICATE"
  ],
  ADVANCED: [
    "ABSTRUSE", "ACQUIESCE", "ADMONISH", "ALACRITY", "AMELIORATE", "ANACHRONISM", "ANOMALY", "ANTIPATHY", "APATHETIC", "ARBITRARY", 
    "ASCETIC", "ASSIDUOUS", "AUDACIOUS", "AUSPICIOUS", "AUSTERE", "BELLIGERENT", "BENEFACTOR", "CACOPHONY", "CAPRICIOUS", "CHICANERY", 
    "CIRCUMLOCUTION", "CLANDESTINE", "COGENT", "COMPLACENT", "CONCILIATORY", "CONUNDRUM", "CORROBORATE", "CREDULOUS", "CURSORY", "DECORUM", 
    "DEFERENCE", "DELETERIOUS", "DEMAGOGUE", "DESICCATED", "DIATRIBE", "DIDACTIC", "DIFFIDENT", "DILATORY", "DISPARATE", "DISSEMBLE", 
    "DISSONANCE", "EBULLIENT", "ECLECTIC", "EFFICACIOUS", "ELEGY", "ELUCIDATE", "ENERVATE", "EPHEMERAL", "EQUIVOCAL", "ERUDITE", 
    "ESOTERIC", "EUPHEMISM", "EXACERBATE", "EXCULPATE", "EXIGENT", "EXONERATE", "FACETIOUS", "FOPPISH", "GARRULOUS", "GREGARIOUS", 
    "HARANGUE", "HEGEMONY", "ICONOCLAST", "IDIOSYNCRATIC", "IMPECUNIOUS", "IMPETUOUS", "INCHOATE", "INCULCATE", "INEXORABLE", "INGENUOUS", 
    "INIMICAL", "INNOCUOUS", "INSCRUTABLE", "INSIPID", "INTRANSIGENT", "INUNDATE", "INVETERATE", "IRASCIBLE", "JUXTAPOSITION", "LACONIC"
  ]
};

type Difficulty = 'EASY' | 'MEDIUM' | 'ADVANCED';

interface LevelData {
  target: string;
  synonyms: string[];
  distractors: string[];
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  decay: number;
  color: string;
  r: number;
}

interface Meteor {
  word: string;
  isSynonym: boolean;
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  dy: number;
  color: string;
  borderColor: string;
}

interface Star {
  x: number;
  y: number;
  s: number;
  dy: number;
}

// --- Components ---

export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [targetWord, setTargetWord] = useState('');
  const [synonymsHit, setSynonymsHit] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [missedHits, setMissedHits] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const levelQueueRef = useRef<LevelData[]>([]);
  const currentLevelRef = useRef<LevelData | null>(null);
  const meteorsRef = useRef<Meteor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const requestRef = useRef<number>(null);
  const frameCountRef = useRef(0);
  const gameSettingsRef = useRef({
    baseSpeed: 1.2,
    spawnRate: 100,
    synonymsHitThisLevel: 0
  });

  // --- Initialization ---

  useEffect(() => {
    // Load Stats
    const saved = localStorage.getItem('synonymSniperStats');
    if (saved) {
      try {
        const stats = JSON.parse(saved);
        setHighScore(stats.highScore || 0);
        setTotalWords(stats.totalWords || 0);
        setCorrectHits(stats.correctHits || 0);
        setMissedHits(stats.missedHits || 0);
        setTotalGames(stats.totalGames || 0);
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    }

    // Init Stars
    const stars: Star[] = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 800,
        s: Math.random() * 2 + 0.5,
        dy: Math.random() * 1 + 0.2
      });
    }
    starsRef.current = stars;

    // Prefetch levels for initial difficulty
    populateQueue(difficulty);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const populateQueue = async (currentDifficulty: Difficulty) => {
    if (isFetching || levelQueueRef.current.length >= 3) return;
    setIsFetching(true);

    try {
      const pool = WORD_POOLS[currentDifficulty];
      const target = pool[Math.floor(Math.random() * pool.length)];
      
      const accuracy = correctHits + missedHits > 0 
        ? (correctHits / (correctHits + missedHits) * 100).toFixed(1) 
        : "N/A";

      const prompt = `Generate expert educational game data for the target word "${target}". 
      User Context: Difficulty=${currentDifficulty}, Career Accuracy=${accuracy}%, Total Games=${totalGames}.
      If accuracy > 80%, provide more challenging/nuanced synonyms and distractors.
      Provide:
      1. target: the word (uppercase)
      2. synonyms: 8-12 synonyms (uppercase, 1-15 chars)
      3. distractors: 8-12 words that are NOT synonyms (uppercase, 1-15 chars).
      Return JSON format.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING },
              synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
              distractors: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["target", "synonyms", "distractors"]
          }
        }
      });

      const data = JSON.parse(response.text);
      if (data && data.synonyms?.length >= 3) {
        levelQueueRef.current.push({
          target: data.target.toUpperCase(),
          synonyms: data.synonyms.map((s: string) => s.toUpperCase()),
          distractors: data.distractors.map((d: string) => d.toUpperCase())
        });
      } else {
        throw new Error("Invalid AI response structure");
      }
    } catch (error) {
      console.warn("AI Generation failed, using static fallback", error);
      // Fallback logic
      const pool = WORD_POOLS[currentDifficulty];
      const target = pool[Math.floor(Math.random() * pool.length)];
      levelQueueRef.current.push({
        target,
        synonyms: ["VALID", "CORRECT", "TRUE", "RIGHT"],
        distractors: ["FALSE", "WRONG", "ERROR", "BAD"]
      });
    } finally {
      setIsFetching(false);
      if (levelQueueRef.current.length < 3) {
        populateQueue(currentDifficulty);
      }
    }
  };

  // --- Game Loop Logic ---

  const handleLevelUp = useCallback(() => {
    if (levelQueueRef.current.length === 0) {
      populateQueue(difficulty);
      return; // Wait for next attempt
    }

    const nextLevel = levelQueueRef.current.shift()!;
    currentLevelRef.current = nextLevel;
    setTargetWord(nextLevel.target);
    setSynonymsHit(0);
    gameSettingsRef.current.synonymsHitThisLevel = 0;
    
    setSpeedLevel(prev => prev + 1);
    gameSettingsRef.current.baseSpeed += 0.3;
    gameSettingsRef.current.spawnRate = Math.max(30, gameSettingsRef.current.spawnRate - 5);
    
    meteorsRef.current = [];
    populateQueue(difficulty); // Refill
  }, [difficulty]);

  const createExplosion = (x: number, y: number, isGood: boolean) => {
    const color = isGood ? '#10b981' : '#ef4444';
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x, y,
        dx: (Math.random() - 0.5) * 10,
        dy: (Math.random() - 0.5) * 10,
        life: 1.0,
        decay: Math.random() * 0.05 + 0.02,
        color,
        r: Math.random() * 4 + 2
      });
    }
  };

  const loseLife = useCallback(() => {
    setCombo(0);
    setLives(prev => {
      const next = prev - 1;
      if (next <= 0) {
        setGameState('GAMEOVER');
        return 0;
      }
      return next;
    });
    setIsFlashing(true);
    setIsShaking(true);
    setTimeout(() => {
      setIsFlashing(false);
      setIsShaking(false);
    }, 400);
  }, []);

  const handleHit = useCallback((meteor: Meteor) => {
    if (meteor.isSynonym) {
      createExplosion(meteor.x, meteor.y, true);
      
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);

      const points = 10 * speedLevel * (1 + Math.floor(newCombo / 5) * 0.5);
      setScore(prev => Math.floor(prev + points));
      setTotalWords(prev => prev + 1);
      setCorrectHits(prev => prev + 1);
      
      gameSettingsRef.current.synonymsHitThisLevel += 1;
      setSynonymsHit(gameSettingsRef.current.synonymsHitThisLevel);

      if (gameSettingsRef.current.synonymsHitThisLevel >= 5) {
        handleLevelUp();
      }
    } else {
      setMissedHits(prev => prev + 1);
      createExplosion(meteor.x, meteor.y, false);
      loseLife();
    }
  }, [speedLevel, handleLevelUp, loseLife, combo, maxCombo]);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    
    frameCountRef.current++;
    
    // Update Stars
    starsRef.current.forEach(s => {
      s.y += s.dy;
      if (s.y > (canvasRef.current?.height || 800)) {
        s.y = 0;
        s.x = Math.random() * (canvasRef.current?.width || 800);
      }
    });

    // Spawn Meteor
    if (frameCountRef.current % gameSettingsRef.current.spawnRate === 0 && currentLevelRef.current) {
      const isSynonym = Math.random() > 0.65;
      const pool = isSynonym ? currentLevelRef.current.synonyms : currentLevelRef.current.distractors;
      if (pool.length > 0) {
        const word = pool[Math.floor(Math.random() * pool.length)];
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.font = 'bold 16px "Inter", sans-serif';
          const w = Math.max(ctx.measureText(word).width + 40, 100);
          const h = 44;
          const x = Math.random() * (canvasRef.current!.width - w) + w/2;
          
          meteorsRef.current.push({
            word,
            isSynonym,
            active: true,
            x,
            y: -50,
            w,
            h,
            dy: gameSettingsRef.current.baseSpeed + (Math.random() * 0.5),
            color: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#38bdf8'
          });
        }
      }
    }

    // Update Meteors
    meteorsRef.current.forEach(m => {
      m.y += m.dy;
      if (canvasRef.current && m.y - m.h/2 > canvasRef.current.height) {
        m.active = false;
        if (m.isSynonym) loseLife();
      }
    });
    meteorsRef.current = meteorsRef.current.filter(m => m.active);

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.life -= p.decay;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

  }, [gameState, loseLife]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(s => {
      ctx.globalAlpha = s.s / 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    if (gameState === 'PLAYING') {
      // Meteors
      meteorsRef.current.forEach(m => {
        ctx.fillStyle = m.color;
        ctx.strokeStyle = m.borderColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        const rx = m.x - m.w/2;
        const ry = m.y - m.h/2;
        const r = 22;
        ctx.moveTo(rx + r, ry);
        ctx.lineTo(rx + m.w - r, ry);
        ctx.quadraticCurveTo(rx + m.w, ry, rx + m.w, ry + r);
        ctx.lineTo(rx + m.w, ry + m.h - r);
        ctx.quadraticCurveTo(rx + m.w, ry + m.h, rx + m.w - r, ry + m.h);
        ctx.lineTo(rx + r, ry + m.h);
        ctx.quadraticCurveTo(rx, ry + m.h, rx, ry + m.h - r);
        ctx.lineTo(rx, ry + r);
        ctx.quadraticCurveTo(rx, ry, rx + r, ry);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.word, m.x, m.y + 1);
      });

      // Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
    }
  }, [gameState]);

  const frame = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(frame);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(frame);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [frame]);

  // --- Interaction ---

  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check hit
    for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
      const m = meteorsRef.current[i];
      if (m.active && x >= m.x - m.w/2 && x <= m.x + m.w/2 && y >= m.y - m.h/2 && y <= m.y + m.h/2) {
        m.active = false;
        handleHit(m);
        return;
      }
    }
  };

  const startGame = () => {
    if (levelQueueRef.current.length === 0) {
      populateQueue(difficulty);
      return;
    }

    setScore(0);
    setLives(5);
    setSpeedLevel(1);
    setCombo(0);
    setMaxCombo(0);
    
    // Scale settings based on difficulty
    const diffSettings = {
      EASY: { baseSpeed: 1.0, spawnRate: 120 },
      MEDIUM: { baseSpeed: 1.3, spawnRate: 100 },
      ADVANCED: { baseSpeed: 1.8, spawnRate: 80 }
    };

    const currentSettings = diffSettings[difficulty];
    
    // Adaptive modifier based on career accuracy
    const accuracy = correctHits + missedHits > 0 ? (correctHits / (correctHits + missedHits)) : 0.5;
    const adaptiveSpeedMod = accuracy > 0.8 ? 1.2 : accuracy < 0.4 ? 0.8 : 1.0;

    gameSettingsRef.current = {
      baseSpeed: currentSettings.baseSpeed * adaptiveSpeedMod,
      spawnRate: Math.floor(currentSettings.spawnRate / adaptiveSpeedMod),
      synonymsHitThisLevel: 0
    };
    
    const firstLevel = levelQueueRef.current.shift()!;
    currentLevelRef.current = firstLevel;
    setTargetWord(firstLevel.target);
    setSynonymsHit(0);
    
    meteorsRef.current = [];
    particlesRef.current = [];
    setTotalGames(prev => prev + 1);
    setGameState('PLAYING');
    
    populateQueue(difficulty); // Refill queue
  };

  // --- Responsive Setup ---

  useEffect(() => {
    const resize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [gameState]);

  // Handle Game Over Logic
  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      const stats = { 
        highScore: Math.max(score, highScore), 
        totalWords,
        correctHits,
        missedHits,
        totalGames
      };
      setHighScore(stats.highScore);
      localStorage.setItem('synonymSniperStats', JSON.stringify(stats));
    }
  }, [gameState, score, highScore, totalWords, correctHits, missedHits, totalGames]);

  const getRank = () => {
    if (totalWords < 50) return "Newbie";
    if (totalWords < 200) return "Learner";
    if (totalWords < 500) return "Advanced";
    if (totalWords < 1000) return "Scholar";
    return "Linguist Master";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div 
        ref={containerRef}
        id="game-container"
        className={`relative w-full max-w-xl aspect-[4/5] bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl shadow-blue-500/10 ${isShaking ? 'animate-[shake_0.4s_ease-in-out_infinite]' : ''}`}
        style={{ touchAction: 'none' }}
      >
        {/* Flash Layer */}
        <div className={`absolute inset-0 bg-red-500/20 pointer-events-none transition-opacity duration-150 z-20 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />

        {/* Game UI Layer */}
        <AnimatePresence>
          {gameState === 'PLAYING' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 left-0 right-0 p-6 z-30 pointer-events-none"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-blue-500/30 flex flex-col">
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Score</span>
                    <span className="text-2xl font-black text-white font-mono">{score}</span>
                  </div>
                  {combo > 1 && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-pink-600 px-4 py-2 rounded-2xl border border-pink-400 flex flex-col justify-center shadow-lg shadow-pink-500/20"
                    >
                      <span className="text-[10px] text-pink-100 font-bold uppercase">Combo</span>
                      <span className="text-xl font-black text-white font-mono">x{combo}</span>
                    </motion.div>
                  )}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={{ scale: i < lives ? 1 : 0.8, opacity: i < lives ? 1 : 0.3 }}
                    >
                      <Heart key={i} className={`w-6 h-6 ${i < lives ? 'fill-red-500 text-red-500' : 'text-slate-700'}`} />
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/90 backdrop-blur-lg border-2 border-slate-800 p-4 rounded-3xl text-center shadow-xl">
                <div className="flex justify-between items-center mb-1 px-2">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Target Word</span>
                  <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">LEVEL {speedLevel}</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-widest font-mono truncate px-2">{targetWord || 'LOADING...'}</h2>
                <div className="mt-3 px-2">
                   <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1">
                     <span>Words Found</span>
                     <span>{synonymsHit}/5 Done</span>
                   </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-full shadow-[0_0_15px_#3b82f6]"
                      initial={{ width: 0 }}
                      animate={{ width: `${(synonymsHit / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <canvas 
          ref={canvasRef} 
          onPointerDown={handlePointerDown}
          className="absolute inset-0 z-10 cursor-crosshair"
        />

        {/* Start Screen */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950 z-40 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start opacity-30 pointer-events-none text-blue-400 font-mono text-[10px]">
                 <div className="text-left">
                   READY TO PLAY<br/>
                   WORDS LOADED<br/>
                   POWER ON
                 </div>
                 <div className="text-right">
                   VERSION 2.1<br/>
                   GOOD LUCK!
                 </div>
              </div>

              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-3xl bg-blue-600/10 border border-blue-500/50 flex items-center justify-center mb-8 relative shadow-[0_0_50px_rgba(59,130,246,0.1)]"
              >
                <Target className="w-12 h-12 text-blue-500" />
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-3xl border-2 border-blue-500/30" 
                />
              </motion.div>

              <h1 className="text-4xl font-black text-white mb-2 font-mono tracking-tighter">
                SYNONYM <span className="text-blue-500">SNIPER</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mb-8 max-w-xs leading-relaxed">
                Catch words with the same meaning! Tap the correct words and avoid the wrong ones.
              </p>

              {/* Difficulty Selection */}
              <div className="w-full max-w-xs mb-8">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-3 tracking-widest">Select Play Level</p>
                <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
                  {(['EASY', 'MEDIUM', 'ADVANCED'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDifficulty(d);
                        levelQueueRef.current = [];
                        populateQueue(d);
                      }}
                      className={`px-2 py-3 rounded-xl text-[10px] font-black transition-all ${
                        difficulty === d 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-y-[-2px]' 
                          : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/50'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={startGame}
                disabled={isFetching && levelQueueRef.current.length === 0}
                className="group relative w-full max-w-xs bg-white text-slate-950 font-black text-xl py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-white/5"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>PLAY NOW</span>
              </button>

              {isFetching && levelQueueRef.current.length === 0 && (
                <div className="mt-4 flex items-center gap-2 text-blue-400 font-bold text-xs animate-pulse font-mono uppercase tracking-widest">
                  <Satellite className="w-4 h-4" />
                  Bringing Words...
                </div>
              )}

              <div className="mt-12 w-full max-w-xs grid grid-cols-2 gap-4 border-t border-slate-800 pt-6">
                <div className="text-left">
                  <p className="text-[10px] text-slate-600 font-bold uppercase mb-1">Rank</p>
                  <p className="text-xl font-bold text-blue-400 font-mono tracking-tight">{getRank()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-600 font-bold uppercase mb-1">High Score</p>
                  <p className="text-xl font-bold text-white font-mono tracking-tight">{highScore}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Screen */}
        <AnimatePresence>
          {gameState === 'GAMEOVER' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-full max-w-sm">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="inline-block px-3 py-1 bg-blue-600/10 border border-blue-500/30 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
                    Score Card
                  </div>
                  <h2 className="text-4xl font-black text-white mb-8 font-mono tracking-tighter">GAME <span className="text-blue-500">OVER</span></h2>
                </motion.div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-left">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Your Score</p>
                    <p className="text-3xl font-black text-white font-mono">{score}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-left">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Best Combo</p>
                    <p className="text-3xl font-black text-pink-500 font-mono">x{maxCombo}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-[10px] text-slate-600 font-bold uppercase mb-4 tracking-widest">Your Badges</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge icon={<Medal />} label="New Player" desc="50 total hits" active={totalWords >= 50} />
                    <Badge icon={<Star />} label="Big Hitter" desc="200 total hits" active={totalWords >= 200} />
                    <Badge icon={<Crown />} label="Word Master" desc="500 total hits" active={totalWords >= 500} />
                    <Badge icon={<Bolt />} label="Super Fast" desc="Reach level 15" active={speedLevel >= 15} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={startGame}
                    className="flex-1 bg-white text-slate-950 font-black text-lg py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-white/5"
                  >
                    <RotateCcw className="w-5 h-5" />
                    RETRY
                  </button>
                  <button 
                    onClick={() => setGameState('START')}
                    className="px-6 border-2 border-slate-800 text-slate-400 font-black text-sm rounded-2xl hover:bg-slate-800 transition-colors"
                  >
                    HOME
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}

function Badge({ icon, label, desc, active }: { icon: React.ReactNode, label: string, desc: string, active: boolean }) {
  return (
    <div className={`p-4 rounded-2xl border text-left transition-all ${active ? 'bg-blue-600/5 border-blue-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${active ? 'bg-blue-600 text-white' : 'bg-slate-800'}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase leading-tight truncate">{label}</p>
      <p className={`text-[8px] font-medium leading-tight ${active ? 'text-blue-300' : 'text-slate-600'}`}>{desc}</p>
    </div>
  );
}
