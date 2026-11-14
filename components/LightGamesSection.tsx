import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, Play, RotateCcw, Trophy } from 'lucide-react';
import { KettleState, RgbTuple } from '../types/kettle';
import { bleController } from '../services/bleController';
import { playTone } from '../services/notifications';
import { useLanguage } from '../i18n/LanguageContext';

interface LightGamesSectionProps {
  kettleState: KettleState;
  onActiveColorChange: (color: { r: number; g: number; b: number } | null) => void;
}

interface ColorPad {
  id: number;
  rgb: RgbTuple;
  hex: string;
  freq: number;
  ringClass: string;
}

const GAME_PADS: ColorPad[] = [
  { id: 0, rgb: [239, 68, 68], hex: '#ef4444', freq: 329.63, ringClass: 'ring-rose-400' },
  { id: 1, rgb: [16, 185, 129], hex: '#10b981', freq: 440.0, ringClass: 'ring-emerald-400' },
  { id: 2, rgb: [59, 130, 246], hex: '#3b82f6', freq: 523.25, ringClass: 'ring-blue-400' },
  { id: 3, rgb: [234, 179, 8], hex: '#eab308', freq: 659.25, ringClass: 'ring-amber-300' },
];

const BEST_SIMON_KEY = 'skykettle_best_simon_v1';
const BEST_GUESS_KEY = 'skykettle_best_guess_v1';

function loadBest(key: string): number {
  try {
    return Number(localStorage.getItem(key) || '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(key: string, val: number): void {
  try {
    localStorage.setItem(key, String(val));
  } catch {
    // ignore
  }
}

export const LightGamesSection: React.FC<LightGamesSectionProps> = ({
  kettleState,
  onActiveColorChange,
}) => {
  const { lang, t } = useLanguage();
  const [gameMode, setGameMode] = useState<'simon' | 'guess'>('simon');
  const [litPadId, setLitPadId] = useState<number | null>(null);
  const [statusText, setStatusText] = useState<string>(t.games.initialStatus);

  // Simon Says state
  const [simonPhase, setSimonPhase] = useState<'idle' | 'showing' | 'input' | 'lost'>('idle');
  const [simonSeq, setSimonSeq] = useState<number[]>([]);
  const [simonStep, setSimonStep] = useState<number>(0);
  const [simonBest, setSimonBest] = useState<number>(() => loadBest(BEST_SIMON_KEY));

  // Guess Color state
  const [guessPhase, setGuessPhase] = useState<'idle' | 'waiting' | 'active'>('idle');
  const [guessTargetId, setGuessTargetId] = useState<number | null>(null);
  const [guessScore, setGuessScore] = useState<number>(0);
  const [guessBest, setGuessBest] = useState<number>(() => loadBest(BEST_GUESS_KEY));
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);

  const timersRef = useRef<number[]>([]);
  const guessStartMsRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    if (simonPhase === 'idle' && guessPhase === 'idle') {
      setStatusText(t.games.initialStatus);
    }
  }, [lang, simonPhase, guessPhase, t.games.initialStatus]);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      onActiveColorChange(null);
    };
  }, [onActiveColorChange]);

  const scheduleTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const flashPad = async (padId: number, durationMs = 460) => {
    const pad = GAME_PADS[padId];
    if (!pad || !mountedRef.current) return;
    setLitPadId(padId);
    onActiveColorChange({ r: pad.rgb[0], g: pad.rgb[1], b: pad.rgb[2] });
    playTone(pad.freq, Math.min(260, durationMs - 60), 0.08);
    if (kettleState.isConnected) {
      void bleController.flashImpulse(pad.rgb, durationMs);
    }
    await new Promise<void>((resolve) => {
      scheduleTimer(() => {
        if (mountedRef.current) {
          setLitPadId((cur) => (cur === padId ? null : cur));
          onActiveColorChange(null);
        }
        resolve();
      }, durationMs);
    });
  };

  const playSimonSequence = (seq: number[]) => {
    clearAllTimers();
    setSimonPhase('showing');
    setSimonStep(0);
    setStatusText(t.games.simonShow(seq.length));

    const run = async () => {
      await new Promise<void>((r) => scheduleTimer(r, 350));
      for (const padId of seq) {
        if (!mountedRef.current) return;
        await flashPad(padId, 480);
        await new Promise<void>((r) => scheduleTimer(r, 180));
      }
      if (!mountedRef.current) return;
      setSimonPhase('input');
      setStatusText(t.games.simonInput(seq.length));
    };
    void run();
  };

  const startSimonGame = () => {
    clearAllTimers();
    const first = [Math.floor(Math.random() * 4)];
    setSimonSeq(first);
    playSimonSequence(first);
  };

  const nextGuessRound = (currentScore: number) => {
    clearAllTimers();
    setGuessPhase('waiting');
    setGuessTargetId(null);
    setStatusText(t.games.guessWait(currentScore));

    const delay = 650 + Math.floor(Math.random() * 900);
    scheduleTimer(() => {
      if (!mountedRef.current) return;
      const target = Math.floor(Math.random() * 4);
      setGuessTargetId(target);
      setGuessPhase('active');
      guessStartMsRef.current = performance.now();
      setStatusText(t.games.guessActive);
      void flashPad(target, 700);
    }, delay);
  };

  const startGuessGame = () => {
    setGuessScore(0);
    setLastReactionMs(null);
    nextGuessRound(0);
  };

  const resetCurrentGame = () => {
    clearAllTimers();
    setLitPadId(null);
    onActiveColorChange(null);
    setSimonPhase('idle');
    setSimonSeq([]);
    setSimonStep(0);
    setGuessPhase('idle');
    setGuessTargetId(null);
    setStatusText(t.games.resetStatus);
  };

  const handlePadPress = (padId: number) => {
    if (gameMode === 'simon') {
      if (simonPhase !== 'input') return;
      void flashPad(padId, 300);

      const expected = simonSeq[simonStep];
      if (padId !== expected) {
        playTone(190, 320, 0.09);
        setSimonPhase('lost');
        const score = Math.max(0, simonSeq.length - 1);
        setStatusText(t.games.simonWrong(score));
        return;
      }

      const nextStep = simonStep + 1;
      if (nextStep >= simonSeq.length) {
        const passed = simonSeq.length;
        if (passed > simonBest) {
          setSimonBest(passed);
          saveBest(BEST_SIMON_KEY, passed);
        }
        const nextSeq = [...simonSeq, Math.floor(Math.random() * 4)];
        setSimonSeq(nextSeq);
        setSimonPhase('showing');
        setStatusText(t.games.simonNext(nextSeq.length));
        scheduleTimer(() => playSimonSequence(nextSeq), 650);
      } else {
        setSimonStep(nextStep);
      }
      return;
    }

    if (guessPhase !== 'active' || guessTargetId === null) return;
    if (padId === guessTargetId) {
      const reaction = Math.round(performance.now() - guessStartMsRef.current);
      const nextScore = guessScore + 1;
      setGuessScore(nextScore);
      setLastReactionMs(reaction);
      if (nextScore > guessBest) {
        setGuessBest(nextScore);
        saveBest(BEST_GUESS_KEY, nextScore);
      }
      playTone(GAME_PADS[padId].freq, 180, 0.09);
      nextGuessRound(nextScore);
    } else {
      playTone(185, 300, 0.09);
      setGuessPhase('idle');
      setGuessTargetId(null);
      setStatusText(t.games.guessWrong(guessScore));
    }
  };

  const isRunning =
    (gameMode === 'simon' && (simonPhase === 'showing' || simonPhase === 'input')) ||
    (gameMode === 'guess' && (guessPhase === 'waiting' || guessPhase === 'active'));

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.games.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.games.sub}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
          <Trophy className="w-4 h-4" />
          <span>{t.games.record}: {gameMode === 'simon' ? simonBest : guessBest}</span>
        </div>
      </div>

      {/* Game Switcher */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            resetCurrentGame();
            setGameMode('simon');
          }}
          className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold transition-colors ${
            gameMode === 'simon'
              ? 'bg-cyan-600 dark:bg-cyan-500 border-cyan-600 dark:border-cyan-500 text-white dark:text-slate-950'
              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {t.games.simonBtn}
        </button>

        <button
          type="button"
          onClick={() => {
            resetCurrentGame();
            setGameMode('guess');
          }}
          className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold transition-colors ${
            gameMode === 'guess'
              ? 'bg-cyan-600 dark:bg-cyan-500 border-cyan-600 dark:border-cyan-500 text-white dark:text-slate-950'
              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {t.games.guessBtn}
        </button>
      </div>

      {/* Status & Reaction Info */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-700 dark:text-slate-200 font-medium">{statusText}</span>
        {gameMode === 'guess' && lastReactionMs !== null && (
          <span className="font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
            {lastReactionMs} {t.common.msShort}
          </span>
        )}
      </div>

      {/* 4 Color Pads */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {GAME_PADS.map((pad, idx) => {
          const isLit = litPadId === pad.id;
          return (
            <button
              key={pad.id}
              type="button"
              onClick={() => handlePadPress(pad.id)}
              className={`min-h-[56px] rounded-xl font-bold text-xs text-white transition-all active:scale-95 flex items-center justify-center shadow-sm ${
                isLit ? `ring-4 ${pad.ringClass} scale-[1.03] brightness-110` : 'opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: pad.hex }}
            >
              {t.games.pads[idx]}
            </button>
          );
        })}
      </div>

      {/* Start / Reset Controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={gameMode === 'simon' ? startSimonGame : startGuessGame}
          className="flex-1 min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Play className="w-4 h-4" />
          <span>{isRunning ? t.games.restartGame : t.games.startGame}</span>
        </button>

        {isRunning && (
          <button
            type="button"
            onClick={resetCurrentGame}
            aria-label={t.games.resetAria}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {!kettleState.isConnected && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {t.games.offlineHint}
        </p>
      )}
    </section>
  );
};
