import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig, type CatArtPackId, type FeelPresetName } from './GameConfig';

const phaserGlobal = globalThis as typeof globalThis & {
  __zjuPhaserGame?: Phaser.Game | null;
};

export type PropEventName =
  | 'zju:usePropRefresh'
  | 'zju:usePropShake'
  | 'zju:activatePropHammer'
  | 'zju:activatePropBomb'
  | 'zju:setComboTheme'
  | 'zju:setCatRenderTheme'
  | 'zju:setCatArtPack'
  | 'zju:forceVariantPreview'
  | 'zju:spawnVariantPilot'
  | 'zju:forceGameOver';

export function emitGameEvent(eventName: PropEventName, payload?: unknown) {
  const game = phaserGlobal.__zjuPhaserGame;
  if (!game) return false;
  game.events.emit(eventName, payload);
  return true;
}

export interface GameOverPayload {
  score: number;
  reason: 'danger_line';
  maxLevel: number;
  mergeCount: number;
}

export interface NextElementPayload {
  level: number;
  name: string;
  variantId: string;
  sourceFile: string;
  previewSrc: string;
  kind?: 'static' | 'animated-reserved';
}

export interface ComboPayload {
  comboCount: number;
  bonusScore: number;
  position: {
    x: number;
    y: number;
  };
}

export interface DebugStatePayload {
  score: number;
  comboCount: number;
  mergeCount: number;
  maxLevel: number;
  isGameOver: boolean;
  dangerElapsedMs: number;
  dangerRatio: number;
  failMode: 'instant' | 'grace' | 'buffer';
  lastSpawnDensity: number;
  canDrop?: boolean;
  activeProp?: 'none' | 'hammer' | 'bomb';
  propImmunityTimer?: number;
  queuedElement: {
    level: number;
    name: string;
    variantId: string;
    sourceFile: string;
    previewSrc: string;
    kind?: 'static' | 'animated-reserved';
  } | null;
  catArtPackId?: CatArtPackId;
}

interface PhaserGameProps {
  feel?: FeelPresetName;
  sessionKey?: number;
  onScoreChange?: (score: number) => void;
  onGameOver?: (payload: GameOverPayload) => void;
  onNextElementChange?: (payload: NextElementPayload) => void;
  onComboAchieved?: (payload: ComboPayload) => void;
  onDebugStateChange?: (payload: DebugStatePayload) => void;
}

export default function PhaserGame({
  feel = 'balanced',
  sessionKey = 0,
  onScoreChange,
  onGameOver,
  onNextElementChange,
  onComboAchieved,
  onDebugStateChange,
}: PhaserGameProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    if (phaserGlobal.__zjuPhaserGame) {
      phaserGlobal.__zjuPhaserGame.destroy(true);
      phaserGlobal.__zjuPhaserGame = null;
    }

    const game = new Phaser.Game(createGameConfig(parent, { feel }));
    phaserGlobal.__zjuPhaserGame = game;

    const handleScore = (score: number) => {
      onScoreChange?.(score);
    };

    const handleGameOver = (payload: GameOverPayload) => {
      onGameOver?.(payload);
    };

    const handleNext = (payload: NextElementPayload) => {
      onNextElementChange?.(payload);
    };

    const handleCombo = (payload: ComboPayload) => {
      onComboAchieved?.(payload);
    };

    const handleDebug = (payload: DebugStatePayload) => {
      onDebugStateChange?.(payload);
    };

    game.events.on('zju:scoreChanged', handleScore);
    game.events.on('zju:gameOver', handleGameOver);
    game.events.on('zju:nextElementChanged', handleNext);
    game.events.on('zju:comboAchieved', handleCombo);
    game.events.on('zju:debugState', handleDebug);

    return () => {
      game.events.off('zju:scoreChanged', handleScore);
      game.events.off('zju:gameOver', handleGameOver);
      game.events.off('zju:nextElementChanged', handleNext);
      game.events.off('zju:comboAchieved', handleCombo);
      game.events.off('zju:debugState', handleDebug);

      if (phaserGlobal.__zjuPhaserGame === game) {
        phaserGlobal.__zjuPhaserGame.destroy(true);
        phaserGlobal.__zjuPhaserGame = null;
      } else {
        game.destroy(true);
      }
      parent.replaceChildren();
    };
  }, [
    feel,
    sessionKey,
    onScoreChange,
    onGameOver,
    onNextElementChange,
    onComboAchieved,
    onDebugStateChange,
  ]);

  return <div ref={parentRef} className="h-full w-full touch-none" />;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    phaserGlobal.__zjuPhaserGame?.destroy(true);
    phaserGlobal.__zjuPhaserGame = null;
  });
}
