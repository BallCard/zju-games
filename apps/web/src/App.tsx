import { useCallback, useEffect, useMemo, useState } from 'react';
import PhaserGame, {
  emitGameEvent,
  type ComboPayload,
  type DebugStatePayload,
  type GameOverPayload,
  type NextElementPayload,
} from './PhaserGame';
import { DROP_LEVEL_UNLOCK_SCORES, type FeelPresetName } from './GameConfig';

const PRESETS: FeelPresetName[] = ['bouncy', 'balanced', 'heavy'];
const TUTORIAL_KEY = 'zju-merge-tutorial-v1-seen';

type ComboTheme = 'pixel' | 'neon' | 'campus';

const TUTORIAL_STEPS = [
  {
    title: 'Step 1/3: Drop',
    desc: 'Hold to preview and release to drop.',
  },
  {
    title: 'Step 2/3: Props',
    desc: 'Refresh and shake are instant props. Hammer and bomb are targeted props.',
  },
  {
    title: 'Step 3/3: Combo & Survival',
    desc: 'Higher combo gives more score. Staying above danger line for too long ends game.',
  },
] as const;

const NEXT_COLORS = [
  '#7dd3fc',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#2dd4bf',
  '#22d3ee',
];

const PROP_SKINS = {
  shake: '/props/shake.png',
  hammer: '/props/hammer.png',
  bomb: '/props/bomb.png',
  refresh: '/props/refresh.png',
} as const;

function FloatingToolButton({
  label,
  onClick,
  active = false,
  iconUrl,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  iconUrl?: string;
}) {
  const hasIcon = Boolean(iconUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-12 w-12 overflow-hidden rounded-full border text-[10px] font-semibold backdrop-blur transition bg-cover bg-center ${
        active
          ? 'border-amber-300 shadow-[0_0_0_2px_rgba(252,211,77,0.35)]'
          : 'border-white/20'
      } ${hasIcon ? 'text-white' : 'bg-slate-900/60 text-slate-100'}`}
      style={
        hasIcon
          ? {
              backgroundImage: `linear-gradient(rgba(2,6,23,0.18), rgba(2,6,23,0.18)), url(${iconUrl})`,
            }
          : undefined
      }
    >
      <span className="absolute inset-0 flex items-center justify-center px-1 text-center leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        {label}
      </span>
    </button>
  );
}

function NextBallIcon({ nextElement }: { nextElement: NextElementPayload | null }) {
  const level = nextElement?.level ?? 1;
  const color = NEXT_COLORS[(level - 1) % NEXT_COLORS.length];

  return (
    <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/65">
      <div
        className="h-7 w-7 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.52), transparent 35%), ${color}`,
        }}
      />
    </div>
  );
}

function resolveProgress(score: number) {
  let currentLevel = 1;

  for (let i = DROP_LEVEL_UNLOCK_SCORES.length - 1; i >= 0; i -= 1) {
    if (score >= DROP_LEVEL_UNLOCK_SCORES[i]) {
      currentLevel = i + 1;
      break;
    }
  }

  if (currentLevel >= 12) {
    return {
      currentLevel: 12,
      nextLevel: 12,
      progressRatio: 1,
    };
  }

  const currentThreshold = DROP_LEVEL_UNLOCK_SCORES[currentLevel - 1];
  const nextThreshold = DROP_LEVEL_UNLOCK_SCORES[currentLevel];
  const progressRatio =
    nextThreshold > currentThreshold
      ? Math.max(0, Math.min(1, (score - currentThreshold) / (nextThreshold - currentThreshold)))
      : 1;

  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    progressRatio,
  };
}

function HeaderProgressShell({ score }: { score: number }) {
  const progress = useMemo(() => resolveProgress(score), [score]);
  const fillWidth = `${Math.round(progress.progressRatio * 100)}%`;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
        <span>Lv{progress.currentLevel}</span>
        <span>Lv{progress.nextLevel}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-slate-700/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 transition-all duration-300"
          style={{ width: fillWidth }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/95 shadow transition-all duration-300"
          style={{ left: fillWidth }}
        />
      </div>
    </div>
  );
}

interface ScoreBurst {
  id: number;
  value: number;
}

export default function App() {
  const [feel, setFeel] = useState<FeelPresetName>('balanced');
  const [sessionKey, setSessionKey] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [nextElement, setNextElement] = useState<NextElementPayload | null>(null);
  const [combo, setCombo] = useState<ComboPayload | null>(null);
  const [debugState, setDebugState] = useState<DebugStatePayload | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [scoreBursts, setScoreBursts] = useState<ScoreBurst[]>([]);
  const [comboTheme, setComboTheme] = useState<ComboTheme>('pixel');

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) setTutorialStep(0);
  }, []);

  useEffect(() => {
    emitGameEvent('zju:setComboTheme', { theme: comboTheme });
  }, [comboTheme]);

  const handleScoreChange = useCallback((nextScore: number) => {
    setScore(nextScore);
  }, []);

  const handleGameOver = useCallback((payload: GameOverPayload) => {
    setGameOver(payload);
  }, []);

  const handleNextElementChange = useCallback((payload: NextElementPayload) => {
    setNextElement(payload);
  }, []);

  const handleComboAchieved = useCallback((payload: ComboPayload) => {
    setCombo(payload);

    const burstId = Date.now() + Math.floor(Math.random() * 1000);
    setScoreBursts((prev) => [...prev, { id: burstId, value: payload.bonusScore }]);
    window.setTimeout(() => {
      setScoreBursts((prev) => prev.filter((x) => x.id !== burstId));
    }, 950);
  }, []);

  const handleDebugStateChange = useCallback((payload: DebugStatePayload) => {
    setDebugState(payload);
  }, []);

  const restart = useCallback(() => {
    setScore(0);
    setCombo(null);
    setNextElement(null);
    setDebugState(null);
    setGameOver(null);
    setScoreBursts([]);
    setSessionKey((x) => x + 1);
  }, []);

  const closeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setTutorialStep(null);
  }, []);

  const nextTutorialStep = useCallback(() => {
    setTutorialStep((step) => {
      if (step === null) return null;
      if (step >= TUTORIAL_STEPS.length - 1) {
        localStorage.setItem(TUTORIAL_KEY, '1');
        return null;
      }
      return step + 1;
    });
  }, []);

  const statusText = useMemo(() => {
    if (!gameOver) return 'Running';
    return `Game Over (${gameOver.reason})`;
  }, [gameOver]);

  const currentTutorial = tutorialStep !== null ? TUTORIAL_STEPS[tutorialStep] : null;
  const activeProp = debugState?.activeProp ?? 'none';

  const handleUseRefresh = useCallback(() => emitGameEvent('zju:usePropRefresh'), []);
  const handleUseShake = useCallback(() => emitGameEvent('zju:usePropShake'), []);
  const handleActivateHammer = useCallback(() => emitGameEvent('zju:activatePropHammer'), []);
  const handleActivateBomb = useCallback(() => emitGameEvent('zju:activatePropBomb'), []);
  const handleForceGameOver = useCallback(() => emitGameEvent('zju:forceGameOver'), []);

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-slate-950 text-slate-100">
      <style>{`
        @keyframes score-pop {
          0% { opacity: 0; transform: translate(-50%, 12px) scale(0.7); }
          20% { opacity: 1; transform: translate(-50%, 0px) scale(1.06); }
          100% { opacity: 0; transform: translate(-50%, -34px) scale(0.95); }
        }
      `}</style>

      <div className="flex h-full w-full flex-col">
        <header className="shrink-0 px-3 pb-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex w-12 shrink-0 items-center justify-center">
              <NextBallIcon nextElement={nextElement} />
            </div>

            <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2">
              <HeaderProgressShell score={score} />
            </div>

            <div className="flex w-12 shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={restart}
                className="h-11 w-11 rounded-full border border-white/20 bg-slate-900/65 text-[11px] font-semibold text-emerald-300"
              >
                restart
              </button>
            </div>
          </div>
        </header>

        <section className="relative min-h-0 flex-1">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 text-center">
            <p className="text-3xl font-bold leading-none text-emerald-300">{score}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-cyan-200/60">ZJU MERGE</p>
            {scoreBursts.map((burst, idx) => (
              <p
                key={burst.id}
                className="absolute left-1/2 top-0 font-mono text-sm font-bold text-amber-300"
                style={{
                  animation: 'score-pop 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  animationDelay: `${idx * 30}ms`,
                  textShadow: '0 0 6px rgba(251,191,36,0.6)',
                }}
              >
                +{burst.value}
              </p>
            ))}
          </div>

          <div className="h-full w-full touch-none">
            <PhaserGame
              feel={feel}
              sessionKey={sessionKey}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
              onNextElementChange={handleNextElementChange}
              onComboAchieved={handleComboAchieved}
              onDebugStateChange={handleDebugStateChange}
            />
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-3 z-20 flex items-center">
            <div className="pointer-events-auto flex flex-col gap-3">
              <FloatingToolButton label="shake" iconUrl={PROP_SKINS.shake} onClick={handleUseShake} />
              <FloatingToolButton
                label="hammer"
                iconUrl={PROP_SKINS.hammer}
                onClick={handleActivateHammer}
                active={activeProp === 'hammer'}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-3 z-20 flex items-center">
            <div className="pointer-events-auto flex flex-col gap-3">
              <FloatingToolButton
                label="bomb"
                iconUrl={PROP_SKINS.bomb}
                onClick={handleActivateBomb}
                active={activeProp === 'bomb'}
              />
              <FloatingToolButton label="refresh" iconUrl={PROP_SKINS.refresh} onClick={handleUseRefresh} />
            </div>
          </div>
        </section>

        <footer className="shrink-0 border-t border-white/10 bg-slate-900/90 px-3 py-2">
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">dev panel</summary>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                  const active = preset === feel;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setFeel(preset);
                        restart();
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowDebug((v) => !v)}
                  className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600"
                >
                  {showDebug ? 'hide-debug' : 'show-debug'}
                </button>

                <button
                  type="button"
                  onClick={() => setTutorialStep(0)}
                  className="rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-indigo-400"
                >
                  how-to-play
                </button>

                <button
                  type="button"
                  onClick={handleForceGameOver}
                  className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
                >
                  force-gameover
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['pixel', 'neon', 'campus'] as ComboTheme[]).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setComboTheme(theme)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      comboTheme === theme
                        ? 'bg-pink-400 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    combo-{theme}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-300">
                Status: <span className="text-amber-300">{statusText}</span> | Next:{' '}
                <span className="text-violet-300">{nextElement ? `Lv${nextElement.level}` : '-'}</span> | Combo:{' '}
                <span className="text-pink-300">{combo ? `x${combo.comboCount}` : '-'}</span> | Theme:{' '}
                <span className="text-cyan-300">{comboTheme}</span>
              </p>

              {showDebug ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-2 text-[11px] text-slate-300">
                  <ul className="space-y-1 font-mono">
                    <li>dangerRatio: {debugState ? debugState.dangerRatio.toFixed(3) : '-'}</li>
                    <li>dangerElapsedMs: {debugState ? debugState.dangerElapsedMs.toFixed(0) : '-'}</li>
                    <li>failMode: {debugState ? debugState.failMode : '-'}</li>
                    <li>activeProp: {debugState?.activeProp ?? '-'}</li>
                    <li>propImmunityMs: {debugState?.propImmunityTimer?.toFixed(0) ?? '-'}</li>
                    <li>comboCount: {debugState ? debugState.comboCount : '-'}</li>
                    <li>mergeCount: {debugState ? debugState.mergeCount : '-'}</li>
                    <li>maxLevel: {debugState ? debugState.maxLevel : '-'}</li>
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </footer>
      </div>

      {currentTutorial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Quick Tutorial</p>
            <h3 className="mt-2 text-xl font-semibold">{currentTutorial.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{currentTutorial.desc}</p>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={closeTutorial}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
              >
                skip
              </button>
              <button
                type="button"
                onClick={nextTutorialStep}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'start' : 'next'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
