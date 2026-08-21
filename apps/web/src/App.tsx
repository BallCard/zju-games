import { useCallback, useEffect, useMemo, useState } from 'react';
import PhaserGame, {
  emitGameEvent,
  type ComboPayload,
  type DebugStatePayload,
  type GameOverPayload,
  type NextElementPayload,
} from './PhaserGame';
import { CAT_ART_PACK_OPTIONS, DEFAULT_CAT_ART_PACK, DROP_LEVEL_UNLOCK_SCORES, type CatArtPackId, type FeelPresetName } from './GameConfig';

const PRESETS: FeelPresetName[] = ['bouncy', 'balanced', 'heavy'];
const TUTORIAL_KEY = 'zju-merge-tutorial-v1-seen';
const SETTINGS_KEYS = {
  feel: 'zju-merge-feel',
  comboTheme: 'zju-merge-combo-theme',
  catRenderTheme: 'zju-merge-cat-render-theme',
  catArtPackId: 'zju-merge-art-pack',
  showDebug: 'zju-merge-show-debug',
} as const;

type ComboTheme = 'pixel' | 'neon' | 'campus';
type CatRenderTheme = 'transparent' | 'cream-card';

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

const PROP_SKINS = {
  shake: '/props/shake.png',
  hammer: '/props/hammer.png',
  bomb: '/props/bomb.png',
  refresh: '/props/refresh.png',
} as const;

const PILOT_VARIANT_BUTTONS = [
  { label: 'spawn-p10', level: 10, variantId: 'cat-l10-memev1-1' },
  { label: 'spawn-p11', level: 11, variantId: 'cat-l11-memev1-1' },
  { label: 'spawn-p12', level: 12, variantId: 'cat-l12-memev1-1' },
] as const;

function FloatingToolButton({
  label,
  emoji,
  onClick,
  active = false,
  iconUrl,
}: {
  label: string;
  emoji: string;
  onClick: () => void;
  active?: boolean;
  iconUrl?: string;
}) {
  const hasIcon = Boolean(iconUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border backdrop-blur-md transition duration-150 bg-cover bg-center ${
        active
          ? 'border-amber-300 bg-amber-100/80 shadow-[0_0_0_3px_rgba(251,191,36,0.35),0_14px_30px_rgba(180,83,9,0.22)] -translate-y-0.5'
          : 'border-slate-900/10 bg-white/45 shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
      }`}
      style={
        hasIcon
          ? {
              backgroundImage: `linear-gradient(rgba(255,248,235,0.68), rgba(255,244,214,0.72)), url(${iconUrl})`,
            }
          : {
              backgroundImage: 'linear-gradient(180deg, rgba(255,250,240,0.95), rgba(250,232,200,0.88))',
            }
      }
    >
      <span className="pointer-events-none text-[22px] leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">{emoji}</span>
      <span className="pointer-events-none mt-1 text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#5D4037] drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]">
        {label}
      </span>
    </button>
  );
}

function NextBallIcon({
  nextElement,
  renderTheme,
}: {
  nextElement: NextElementPayload | null;
  renderTheme: CatRenderTheme;
}) {
  const level = nextElement?.level ?? 1;
  const src = nextElement?.previewSrc ?? `/assets/cats/cat-${level}.png`;
  const shellClass =
    renderTheme === 'cream-card'
      ? 'border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,248,238,0.96),rgba(248,231,202,0.9))] shadow-[0_10px_24px_rgba(15,23,42,0.14)]'
      : 'border-white/20 bg-slate-900/55 shadow-[0_8px_18px_rgba(15,23,42,0.2)]';

  return (
    <div
      className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[1.25rem] border ${shellClass}`}
    >
      <img
        src={src}
        alt={`Next cat level ${level}`}
        className={renderTheme === 'cream-card' ? 'h-9 w-9 object-contain' : 'h-10 w-10 object-contain drop-shadow-[0_4px_10px_rgba(255,255,255,0.16)]'}
        draggable={false}
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
      <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-700/35 ring-1 ring-slate-900/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7dd3fc] via-[#a5b4fc] to-[#f9a8d4] transition-all duration-300"
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
  const [feel, setFeel] = useState<FeelPresetName>(() => (localStorage.getItem(SETTINGS_KEYS.feel) as FeelPresetName) || 'balanced');
  const [sessionKey, setSessionKey] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [nextElement, setNextElement] = useState<NextElementPayload | null>(null);
  const [combo, setCombo] = useState<ComboPayload | null>(null);
  const [debugState, setDebugState] = useState<DebugStatePayload | null>(null);
  const [showDebug, setShowDebug] = useState(() => localStorage.getItem(SETTINGS_KEYS.showDebug) === '1');
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [scoreBursts, setScoreBursts] = useState<ScoreBurst[]>([]);
  const [comboTheme, setComboTheme] = useState<ComboTheme>(() => (localStorage.getItem(SETTINGS_KEYS.comboTheme) as ComboTheme) || 'pixel');
  const [catRenderTheme, setCatRenderTheme] = useState<CatRenderTheme>(() => (localStorage.getItem(SETTINGS_KEYS.catRenderTheme) as CatRenderTheme) || 'cream-card');
  const [catArtPackId, setCatArtPackId] = useState<CatArtPackId>(() => (localStorage.getItem(SETTINGS_KEYS.catArtPackId) as CatArtPackId) || DEFAULT_CAT_ART_PACK);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) setTutorialStep(0);
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.comboTheme, comboTheme);
    emitGameEvent('zju:setComboTheme', { theme: comboTheme });
  }, [comboTheme]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.catRenderTheme, catRenderTheme);
    emitGameEvent('zju:setCatRenderTheme', { theme: catRenderTheme });
  }, [catRenderTheme]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.catArtPackId, catArtPackId);
    emitGameEvent('zju:setCatArtPack', { packId: catArtPackId });
  }, [catArtPackId]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.feel, feel);
  }, [feel]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.showDebug, showDebug ? '1' : '0');
  }, [showDebug]);

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
  const handleForcePilotVariant = useCallback((level: number, variantId: string) => {
    setCatArtPackId('meme-chaos-v1');
    emitGameEvent('zju:setCatArtPack', { packId: 'meme-chaos-v1' });
    emitGameEvent('zju:spawnVariantPilot', { level, variantId });
  }, []);

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
          <div className="flex items-center gap-2.5">
            <div className="flex w-12 shrink-0 items-center justify-center">
              <NextBallIcon nextElement={nextElement} renderTheme={catRenderTheme} />
            </div>

            <div className="min-w-0 flex-1 rounded-[1.6rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(245,230,205,0.9))] px-3 py-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.12)]">
              <HeaderProgressShell score={score} />
            </div>

            <div className="flex w-12 shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={restart}
                className="h-12 w-12 rounded-[1.25rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,248,238,0.96),rgba(248,231,202,0.9))] text-[11px] font-black uppercase tracking-[0.08em] text-emerald-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
              >
                restart
              </button>
            </div>
          </div>
        </header>

        <section className="relative min-h-0 flex-1">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 text-center">
            <p className="text-[2.15rem] font-black leading-none text-emerald-400 [text-shadow:0_0_8px_rgba(255,255,255,0.85),0_4px_0_rgba(255,255,255,0.55),0_10px_18px_rgba(16,185,129,0.18)]">{score}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.34em] text-[#6c8296]/90">ZJU MERGE</p>
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
              <FloatingToolButton label="shake" emoji="📳" iconUrl={PROP_SKINS.shake} onClick={handleUseShake} />
              <FloatingToolButton
                label="hammer"
                emoji="🔨"
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
                emoji="💣"
                iconUrl={PROP_SKINS.bomb}
                onClick={handleActivateBomb}
                active={activeProp === 'bomb'}
              />
              <FloatingToolButton label="refresh" emoji="🔄" iconUrl={PROP_SKINS.refresh} onClick={handleUseRefresh} />
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

              <div className="flex flex-wrap gap-2">
                {(['cream-card', 'transparent'] as CatRenderTheme[]).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setCatRenderTheme(theme)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      catRenderTheme === theme
                        ? 'bg-emerald-300 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    cat-{theme}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {CAT_ART_PACK_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCatArtPackId(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      catArtPackId === id
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >{label}</button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {PILOT_VARIANT_BUTTONS.map(({ label, level, variantId }) => (
                  <button
                    key={variantId}
                    type="button"
                    onClick={() => handleForcePilotVariant(level, variantId)}
                    className="rounded-full bg-lime-300 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-lime-200"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-300">
                Status: <span className="text-amber-300">{statusText}</span> | Next:{' '}
                <span className="text-violet-300">{nextElement ? `Lv${nextElement.level}` : '-'}</span>
                {nextElement ? <span className="text-slate-500"> / {nextElement.variantId}</span> : null} | Combo:{' '}
                <span className="text-pink-300">{combo ? `x${combo.comboCount}` : '-'}</span> | Theme:{' '}
                <span className="text-cyan-300">{comboTheme}</span> | Cat:{' '}
                <span className="text-emerald-300">{catRenderTheme}</span> | Pack:{' '}
                <span className="text-amber-300">{catArtPackId}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(37,24,10,0.45)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.8rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,232,209,0.95))] p-5 text-[#4A3525] shadow-[0_24px_60px_rgba(86,56,24,0.24)]">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#d97706]">Quick Tutorial</p>
            <h3 className="mt-2 text-xl font-black text-[#5D4037]">{currentTutorial.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#6b4f3b]">{currentTutorial.desc}</p>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={closeTutorial}
                className="rounded-xl bg-white/80 px-3 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#5D4037] shadow-[0_8px_18px_rgba(15,23,42,0.08)] hover:bg-[#fff4e1]"
              >
                skip
              </button>
              <button
                type="button"
                onClick={nextTutorialStep}
                className="rounded-xl bg-[linear-gradient(180deg,#f9a8d4,#fb923c)] px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#fff7ed] shadow-[0_12px_24px_rgba(251,146,60,0.28)] hover:brightness-105"
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
