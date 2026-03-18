import Phaser from 'phaser';
import {
  BASE_ELEMENT_DENSITY,
  COMBO_WINDOW_MS,
  DANGER_LINE_RATIO,
  DROP_LEVEL_UNLOCK_SCORES,
  ELEMENT_DENSITY_DECAY_FACTOR,
  FAILURE_GRACE_MS,
  ZJU_ELEMENTS,
  type MatterFeelPreset,
} from './GameConfig';

type MatterImage = Phaser.Physics.Matter.Image;
type ActiveProp = 'none' | 'hammer' | 'bomb';
type ComboTheme = 'pixel' | 'neon' | 'campus';

interface MergeRequest {
  a: MatterImage;
  b: MatterImage;
  nextLevel: number;
  x: number;
  y: number;
}

interface GameOverPayload {
  score: number;
  reason: 'danger_line';
  maxLevel: number;
  mergeCount: number;
}

type DangerLevel = 'READY' | 'WARNING' | 'DANGER' | 'CRITICAL';

const MAX_LEVEL = 12;
const DROP_COOLDOWN_MS = 700;
const DROP_SPAWN_Y = 60;
const PROP_IMMUNITY_MS = 2000;
const BOMB_KILL_RADIUS = 82;
const BOMB_PUSH_RADIUS = 170;

const LEVEL_COLORS = [
  0x7dd3fc,
  0x60a5fa,
  0x818cf8,
  0xa78bfa,
  0xc084fc,
  0xf472b6,
  0xfb7185,
  0xfb923c,
  0xfacc15,
  0x4ade80,
  0x2dd4bf,
  0x22d3ee,
];

export default class MainScene extends Phaser.Scene {
  private currentScore = 0;
  private maxLevelReached = 1;
  private mergeCount = 0;
  private queuedElementType: string | null = null;
  private currentComboCount = 0;
  private lastMergeTimestamp = 0;
  private lastSpawnDensity = 0;

  private isGameOver = false;
  private dangerTimer = 0;
  private isInDanger = false;
  private canDrop = true;

  private activeProp: ActiveProp = 'none';
  private propImmunityTimer = 0;

  private comboTheme: ComboTheme = 'pixel';
  private comboFlashOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverBanner?: Phaser.GameObjects.Container;
  private gameOverBannerDismissAt = 0;

  private dangerLine?: Phaser.GameObjects.Rectangle;

  private worldLeft = 16;
  private worldRight = 16;
  private spawnZoneY = 0;

  private isAiming = false;
  private aimX = 0;
  private aimPreview?: Phaser.GameObjects.Image;
  private aimGuide?: Phaser.GameObjects.Graphics;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.createPlaceholderTextures();
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.worldRight = w - 16;
    this.spawnZoneY = Math.floor(h * DANGER_LINE_RATIO);

    this.matter.world.setBounds(this.worldLeft, 16, w - 32, h - 32);

    this.dangerLine = this.add.rectangle(w / 2, this.spawnZoneY, w - 24, 2, 0xef4444, 0.75);
    this.dangerLine.setOrigin(0.5, 0.5);

    this.comboFlashOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0);
    this.comboFlashOverlay.setDepth(110);
    this.comboFlashOverlay.setScrollFactor(0);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    this.matter.world.on('collisionstart', this.handleCollisionStart, this);

    this.game.events.on('zju:usePropRefresh', this.usePropRefresh, this);
    this.game.events.on('zju:usePropShake', this.usePropShake, this);
    this.game.events.on('zju:activatePropHammer', this.activatePropHammer, this);
    this.game.events.on('zju:activatePropBomb', this.activatePropBomb, this);
    this.game.events.on('zju:setComboTheme', this.setComboTheme, this);
    this.game.events.on('zju:forceGameOver', this.forceGameOver, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.matter.world.off('collisionstart', this.handleCollisionStart, this);
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.off('pointerupoutside', this.handlePointerUp, this);

      this.game.events.off('zju:usePropRefresh', this.usePropRefresh, this);
      this.game.events.off('zju:usePropShake', this.usePropShake, this);
      this.game.events.off('zju:activatePropHammer', this.activatePropHammer, this);
      this.game.events.off('zju:activatePropBomb', this.activatePropBomb, this);
      this.game.events.off('zju:setComboTheme', this.setComboTheme, this);
      this.game.events.off('zju:forceGameOver', this.forceGameOver, this);

      this.clearAimVisuals();
      if (this.comboFlashOverlay) {
        this.comboFlashOverlay.destroy();
        this.comboFlashOverlay = undefined;
      }
      if (this.gameOverBanner) {
        this.gameOverBanner.destroy();
        this.gameOverBanner = undefined;
      }
    });

    this.rollAndSetNextQueuedElement();
    this.emitScore();
    this.emitDangerState();
    this.emitDebugState();
  }

  update(_time: number, delta: number) {
    this.syncElementLabels();

    if (this.isGameOver) return;

    if (this.propImmunityTimer > 0) {
      this.propImmunityTimer = Math.max(0, this.propImmunityTimer - delta);
      this.isInDanger = false;
      this.dangerTimer = 0;
      this.updateDangerUI();
      this.emitDangerState();
      this.emitDebugState();
      return;
    }

    const minSettledTopY = this.getMinSettledTopY();

    if (minSettledTopY !== null && minSettledTopY < this.spawnZoneY) {
      this.isInDanger = true;
      this.dangerTimer = Math.min(FAILURE_GRACE_MS, this.dangerTimer + delta);
    } else if (this.dangerTimer > 0) {
      this.dangerTimer = Math.max(0, this.dangerTimer - delta * 5);
      if (this.dangerTimer <= 0) {
        this.dangerTimer = 0;
        this.isInDanger = false;
      }
    } else {
      this.isInDanger = false;
    }

    this.updateDangerUI();
    this.emitDangerState();
    this.emitDebugState();

    if (this.dangerTimer >= FAILURE_GRACE_MS) {
      this.finishGame('danger_line');
    }
  }

  public usePropRefresh() {
    this.rollAndSetNextQueuedElement();
    this.game.events.emit('zju:propUsed', { prop: 'refresh' });
  }

  public usePropShake() {
    if (this.isGameOver) return;

    this.propImmunityTimer = PROP_IMMUNITY_MS;

    const Body = (Phaser.Physics.Matter as any).Matter.Body;
    for (const obj of this.getSettledElements()) {
      const body = obj.body as MatterJS.BodyType;
      Body.applyForce(body, body.position, {
        x: Phaser.Math.FloatBetween(-0.023, 0.023),
        y: Phaser.Math.FloatBetween(-0.075, -0.04),
      });
    }

    this.game.events.emit('zju:propUsed', { prop: 'shake' });
    this.emitDebugState();
  }

  public activatePropHammer() {
    this.activeProp = 'hammer';
    this.isAiming = false;
    this.clearAimVisuals();
    this.game.events.emit('zju:activePropChanged', { activeProp: this.activeProp });
    this.emitDebugState();
  }

  public activatePropBomb() {
    this.activeProp = 'bomb';
    this.isAiming = false;
    this.clearAimVisuals();
    this.game.events.emit('zju:activePropChanged', { activeProp: this.activeProp });
    this.emitDebugState();
  }

  public setComboTheme(payload?: { theme?: ComboTheme }) {
    const theme = payload?.theme;
    if (theme === 'pixel' || theme === 'neon' || theme === 'campus') {
      this.comboTheme = theme;
      this.emitDebugState();
    }
  }

  public forceGameOver() {
    if (this.isGameOver) return;
    this.finishGame('danger_line');
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) {
      if (this.time.now >= this.gameOverBannerDismissAt) {
        this.dismissGameOverBanner();
      }
      return;
    }

    if (this.activeProp !== 'none') {
      this.isAiming = false;
      this.clearAimVisuals();
      return;
    }

    if (!this.queuedElementType) return;

    this.isAiming = true;
    this.updateAim(pointer.x);
    this.renderAimVisuals();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isAiming) return;

    this.updateAim(pointer.x);
    this.renderAimVisuals();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) return;

    if (this.activeProp !== 'none') {
      this.tryUseActivePropAt(pointer.x, pointer.y);
      return;
    }

    if (!this.isAiming) return;
    this.commitDropFromAim();
  }

  private tryUseActivePropAt(x: number, y: number) {
    if (this.activeProp === 'hammer') {
      const used = this.applyHammerAt(x, y);
      if (used) {
        this.activeProp = 'none';
        this.game.events.emit('zju:propUsed', { prop: 'hammer' });
        this.game.events.emit('zju:activePropChanged', { activeProp: this.activeProp });
        this.emitDebugState();
      }
      return;
    }

    if (this.activeProp === 'bomb') {
      const used = this.applyBombAt(x, y);
      if (used) {
        this.activeProp = 'none';
        this.game.events.emit('zju:propUsed', { prop: 'bomb' });
        this.game.events.emit('zju:activePropChanged', { activeProp: this.activeProp });
        this.emitDebugState();
      }
    }
  }

  private applyHammerAt(x: number, y: number): boolean {
    const target = this.pickSettledTargetAt(x, y);
    if (!target) return false;

    target.destroy();
    return true;
  }

  private applyBombAt(x: number, y: number): boolean {
    const target = this.pickSettledTargetAt(x, y);
    if (!target) return false;

    const centerX = target.x;
    const centerY = target.y;
    target.destroy();

    this.propImmunityTimer = PROP_IMMUNITY_MS;

    const Body = (Phaser.Physics.Matter as any).Matter.Body;

    for (const obj of this.getSettledElements()) {
      if (!obj.active || !obj.body) continue;

      const dx = obj.x - centerX;
      const dy = obj.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= BOMB_KILL_RADIUS) {
        obj.destroy();
      }
    }

    for (const obj of this.getSettledElements()) {
      if (!obj.active || !obj.body) continue;

      const dx = obj.x - centerX;
      const dy = obj.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= BOMB_KILL_RADIUS || dist > BOMB_PUSH_RADIUS) continue;

      const norm = dist > 0.001 ? dist : 1;
      const nx = dx / norm;
      const ny = dy / norm;
      const factor = Phaser.Math.Clamp(1 - dist / BOMB_PUSH_RADIUS, 0.12, 1);
      const force = 0.02 * factor;

      const body = obj.body as MatterJS.BodyType;
      Body.applyForce(body, body.position, {
        x: nx * force,
        y: ny * force - 0.0025,
      });
    }

    return true;
  }

  private getSettledElements(): MatterImage[] {
    const children = this.children.list as Phaser.GameObjects.GameObject[];
    const result: MatterImage[] = [];

    for (const child of children) {
      const obj = child as unknown as MatterImage;
      if (!obj?.active || !obj.body || !obj.getData) continue;

      const level = Number(obj.getData('level'));
      if (!Number.isFinite(level)) continue;
      if (!obj.getData('isSettled')) continue;

      result.push(obj);
    }

    return result;
  }

  private pickSettledTargetAt(x: number, y: number): MatterImage | null {
    let picked: MatterImage | null = null;
    let minDist = Number.POSITIVE_INFINITY;

    for (const obj of this.getSettledElements()) {
      const radius = Number(obj.getData('radius')) || ((obj.body as MatterJS.BodyType).circleRadius ?? 0);
      const dx = obj.x - x;
      const dy = obj.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      if (dist < minDist) {
        minDist = dist;
        picked = obj;
      }
    }

    return picked;
  }

  private updateAim(pointerX: number) {
    if (!this.queuedElementType) return;

    const queued = this.getElementConfigByTextureKey(this.queuedElementType);
    this.aimX = Phaser.Math.Clamp(
      pointerX,
      this.worldLeft + queued.radius,
      this.worldRight - queued.radius,
    );
  }

  private commitDropFromAim() {
    const queuedTexture = this.queuedElementType;
    this.isAiming = false;

    if (this.isGameOver || !this.canDrop || !queuedTexture) {
      this.clearAimVisuals();
      return;
    }

    const queued = this.getElementConfigByTextureKey(queuedTexture);
    this.spawnElement(queued.level, this.aimX, DROP_SPAWN_Y);

    this.canDrop = false;
    this.time.delayedCall(DROP_COOLDOWN_MS, () => {
      if (!this.isGameOver) {
        this.canDrop = true;
      }
    });

    this.rollAndSetNextQueuedElement();
    this.clearAimVisuals();
  }

  private renderAimVisuals() {
    const queuedTexture = this.queuedElementType;
    if (!queuedTexture || !this.isAiming || this.activeProp !== 'none') {
      this.clearAimVisuals();
      return;
    }

    const queued = this.getElementConfigByTextureKey(queuedTexture);

    if (!this.aimPreview) {
      this.aimPreview = this.add.image(this.aimX, DROP_SPAWN_Y, queuedTexture);
      this.aimPreview.setDepth(30);
      this.aimPreview.setAlpha(0.7);
    }

    this.aimPreview.setTexture(queuedTexture);
    this.aimPreview.setDisplaySize(queued.radius * 2, queued.radius * 2);
    this.aimPreview.setPosition(this.aimX, DROP_SPAWN_Y);

    if (!this.aimGuide) {
      this.aimGuide = this.add.graphics();
      this.aimGuide.setDepth(29);
    }

    this.aimGuide.clear();
    const startY = DROP_SPAWN_Y + queued.radius + 6;
    const endY = Math.min(this.scale.height - 26, this.spawnZoneY + 28);
    const segment = 11;
    const gap = 8;

    this.aimGuide.lineStyle(2, 0x67e8f9, 0.8);
    for (let y = startY; y < endY; y += segment + gap) {
      const y2 = Math.min(y + segment, endY);
      this.aimGuide.beginPath();
      this.aimGuide.moveTo(this.aimX, y);
      this.aimGuide.lineTo(this.aimX, y2);
      this.aimGuide.strokePath();
    }
  }

  private clearAimVisuals() {
    if (this.aimGuide) {
      this.aimGuide.destroy();
      this.aimGuide = undefined;
    }

    if (this.aimPreview) {
      this.aimPreview.destroy();
      this.aimPreview = undefined;
    }
  }

  private createPlaceholderTextures() {
    for (const element of ZJU_ELEMENTS) {
      if (this.textures.exists(element.textureKey)) continue;

      const size = element.radius * 2;
      const g = this.add.graphics({ x: -9999, y: -9999 });
      const color = LEVEL_COLORS[(element.level - 1) % LEVEL_COLORS.length];

      g.fillStyle(color, 1);
      g.fillCircle(element.radius, element.radius, element.radius);

      g.lineStyle(2, 0x0f172a, 0.95);
      g.strokeCircle(element.radius, element.radius, element.radius - 1);

      const px = Math.max(2, Math.floor(size * 0.08));
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(Math.floor(size * 0.28), Math.floor(size * 0.22), px * 2, px * 2);
      g.fillRect(Math.floor(size * 0.44), Math.floor(size * 0.3), px, px);

      g.generateTexture(element.textureKey, size, size);
      g.destroy();
    }
  }

  private getFeel(): MatterFeelPreset {
    return (this.registry.get('matterFeel') ?? {
      gravityY: 1.02,
      restitution: 0.24,
      friction: 0.005,
      frictionAir: 0.001,
      frictionStatic: 0.006,
      densityScale: 1,
    }) as MatterFeelPreset;
  }

  private getElementConfig(level: number) {
    const cfg = ZJU_ELEMENTS[level - 1];
    if (!cfg) {
      throw new Error(`Invalid level: ${level}`);
    }
    return cfg;
  }

  private getElementConfigByTextureKey(textureKey: string) {
    const cfg = ZJU_ELEMENTS.find((x) => x.textureKey === textureKey);
    if (!cfg) {
      throw new Error(`Invalid texture key: ${textureKey}`);
    }
    return cfg;
  }

  private getUnlockedDropLevelByScore(score: number) {
    let unlockedLevel = 1;

    for (let i = DROP_LEVEL_UNLOCK_SCORES.length - 1; i >= 0; i -= 1) {
      if (score >= DROP_LEVEL_UNLOCK_SCORES[i]) {
        unlockedLevel = i + 1;
        break;
      }
    }

    return Phaser.Math.Clamp(Math.max(2, unlockedLevel), 2, MAX_LEVEL);
  }

  private pickNextDropLevel(maxLevel: number) {
    const cappedLevel = Phaser.Math.Clamp(maxLevel, 2, MAX_LEVEL);
    const weights: number[] = [];
    let totalWeight = 0;

    for (let level = 1; level <= cappedLevel; level += 1) {
      const distance = cappedLevel - level;
      const weight = Math.pow(0.72, distance);
      weights.push(weight);
      totalWeight += weight;
    }

    let roll = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        return i + 1;
      }
    }

    return cappedLevel;
  }

  private rollAndSetNextQueuedElement() {
    const unlockedLevel = this.getUnlockedDropLevelByScore(this.currentScore);
    const nextLevel = this.pickNextDropLevel(unlockedLevel);
    const nextCfg = this.getElementConfig(nextLevel);
    this.queuedElementType = nextCfg.textureKey;

    const payload = {
      textureKey: nextCfg.textureKey,
      level: nextCfg.level,
      name: nextCfg.name,
    };

    this.events.emit('nextElementChanged', payload);
    this.game.events.emit('zju:nextElementChanged', payload);
    this.emitDebugState();
  }

  private computeDensityForLevel(level: number, feel: MatterFeelPreset) {
    return (
      BASE_ELEMENT_DENSITY *
      feel.densityScale *
      Math.pow(ELEMENT_DENSITY_DECAY_FACTOR, level - 1)
    );
  }

  private spawnElement(level: number, x: number, y: number, feel?: MatterFeelPreset): MatterImage {
    const actualFeel = feel ?? this.getFeel();
    const cfg = this.getElementConfig(level);

    const image = this.matter.add.image(x, y, cfg.textureKey, undefined, {
      restitution: actualFeel.restitution,
      friction: actualFeel.friction,
      frictionAir: actualFeel.frictionAir,
      frictionStatic: actualFeel.frictionStatic,
      density: this.computeDensityForLevel(level, actualFeel),
      label: `zju-level-${level}`,
    });

    image.setCircle(cfg.radius);

    const dynamicDensity = this.computeDensityForLevel(level, actualFeel);
    image.setDensity(dynamicDensity);
    this.lastSpawnDensity = dynamicDensity;

    image.setDisplaySize(cfg.radius * 2, cfg.radius * 2);
    image.setDataEnabled();
    image.setData('level', level);
    image.setData('radius', cfg.radius);
    image.setData('merged', false);
    image.setData('isSettled', false);

    this.attachElementLabel(image, cfg.name, cfg.radius);

    if (level > this.maxLevelReached) {
      this.maxLevelReached = level;
    }

    this.emitDebugState();

    return image;
  }

  private markElementSettled(body: MatterJS.BodyType) {
    const obj = body.gameObject as MatterImage | undefined;
    if (!obj || !obj.active || !obj.getData) return;

    const level = Number(obj.getData('level'));
    if (!Number.isFinite(level)) return;

    if (!obj.getData('isSettled')) {
      obj.setData('isSettled', true);
    }
  }

  private handleCollisionStart(event: { pairs: unknown[] }) {
    if (this.isGameOver) return;

    const pairs = event.pairs as Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }>;

    const reservedBodyIds = new Set<number>();
    const mergeQueue: MergeRequest[] = [];

    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      this.markElementSettled(bodyA);
      this.markElementSettled(bodyB);

      const a = bodyA.gameObject as MatterImage | undefined;
      const b = bodyB.gameObject as MatterImage | undefined;

      if (!a || !b || !a.active || !b.active) continue;
      if (a.getData('merged') || b.getData('merged')) continue;

      const levelA = Number(a.getData('level'));
      const levelB = Number(b.getData('level'));
      if (!Number.isFinite(levelA) || !Number.isFinite(levelB)) continue;
      if (levelA !== levelB || levelA >= MAX_LEVEL) continue;

      const idA = bodyA.id;
      const idB = bodyB.id;
      if (reservedBodyIds.has(idA) || reservedBodyIds.has(idB)) continue;

      reservedBodyIds.add(idA);
      reservedBodyIds.add(idB);

      mergeQueue.push({
        a,
        b,
        nextLevel: levelA + 1,
        x: (bodyA.position.x + bodyB.position.x) / 2,
        y: (bodyA.position.y + bodyB.position.y) / 2,
      });
    }

    for (const merge of mergeQueue) {
      this.executeMerge(merge);
    }
  }

  private executeMerge(merge: MergeRequest) {
    const { a, b, nextLevel, x, y } = merge;

    if (!a.active || !b.active) return;

    a.setData('merged', true);
    b.setData('merged', true);

    a.destroy();
    b.destroy();

    const merged = this.spawnElement(nextLevel, x, y - 2);
    merged.setVelocity((Math.random() - 0.5) * 1.2, -4.2);

    const now = this.time.now;
    if (now - this.lastMergeTimestamp < COMBO_WINDOW_MS) {
      this.currentComboCount += 1;
    } else {
      this.currentComboCount = 1;
    }
    this.lastMergeTimestamp = now;

    const baseScore = this.getElementConfig(nextLevel).score;
    const finalAddScore = Math.floor(baseScore * (1 + 0.1 * (this.currentComboCount - 1)));

    this.currentScore += finalAddScore;
    this.mergeCount += 1;

    this.showComboFloatingText(x, y, this.currentComboCount, finalAddScore);
    this.showComboCenterBanner(this.currentComboCount, finalAddScore);
    this.triggerComboScreenFx(this.currentComboCount);

    this.game.events.emit('zju:comboAchieved', {
      comboCount: this.currentComboCount,
      bonusScore: finalAddScore,
      position: { x, y },
    });

    this.emitScore();
    this.emitDebugState();
  }

  private showComboFloatingText(x: number, y: number, comboCount: number, bonusScore: number) {
    if (comboCount <= 1) return;

    const text = this.add.text(x - 28, y - 24, `Combo x${comboCount}\n+${bonusScore}`, {
      color: '#fef08a',
      fontFamily: 'monospace',
      fontSize: '14px',
      align: 'center',
      stroke: '#1e293b',
      strokeThickness: 3,
    });
    text.setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 58,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    });
  }

  private triggerComboScreenFx(comboCount: number) {
    if (comboCount < 3) return;

    const intensity = Phaser.Math.Clamp(0.002 + (comboCount - 2) * 0.0018, 0.002, 0.018);
    const duration = Phaser.Math.Clamp(90 + comboCount * 18, 90, 220);
    this.cameras.main.shake(duration, intensity, false);

    if (!this.comboFlashOverlay) return;

    this.comboFlashOverlay.setAlpha(Phaser.Math.Clamp(0.04 + comboCount * 0.02, 0.04, 0.22));
    this.tweens.add({
      targets: this.comboFlashOverlay,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
    });
  }

  private showComboCenterBanner(comboCount: number, bonusScore: number) {
    if (comboCount < 2) return;

    let title = 'COMBO x' + comboCount;
    let color = '#67e8f9';
    let size = 34;
    let stroke = '#0f172a';
    let glow = color;
    let fontFamily = 'Verdana';

    if (this.comboTheme === 'pixel') {
      fontFamily = 'monospace';
      stroke = '#020617';
      glow = '#22d3ee';
    } else if (this.comboTheme === 'neon') {
      fontFamily = 'Trebuchet MS';
      stroke = '#0a0a1f';
      glow = '#f472b6';
    } else {
      fontFamily = 'KaiTi';
      stroke = '#1e293b';
      glow = '#93c5fd';
    }

    if (comboCount >= 6) {
      title = 'MEGA COMBO x' + comboCount;
      color = this.comboTheme === 'campus' ? '#60a5fa' : '#f472b6';
      size = 44;
    } else if (comboCount >= 4) {
      title = 'SUPER COMBO x' + comboCount;
      color = this.comboTheme === 'campus' ? '#34d399' : '#facc15';
      size = 39;
    }

    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.42;
    const bannerText = title + '\n+' + bonusScore;

    const banner = this.add.text(centerX, centerY + 18, bannerText, {
      fontFamily,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      align: 'center',
      stroke,
      strokeThickness: this.comboTheme === 'pixel' ? 10 : 8,
      lineSpacing: 6,
    });
    banner.setOrigin(0.5, 0.5);
    banner.setDepth(120);
    banner.setAlpha(0);
    banner.setShadow(0, 0, glow, this.comboTheme === 'neon' ? 28 : 18, true, true);

    const maxBannerWidth = this.scale.width * 0.86;
    const fitRatio = banner.width > maxBannerWidth ? maxBannerWidth / banner.width : 1;
    const startScale = (this.comboTheme === 'pixel' ? 0.52 : 0.58) * fitRatio;
    const peakScale = 1.06 * fitRatio;
    const endScale = 0.96 * fitRatio;
    banner.setScale(startScale);

    this.tweens.add({
      targets: banner,
      alpha: 0.9,
      scale: peakScale,
      y: centerY,
      duration: 150,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          scale: endScale,
          y: centerY - 20,
          duration: 460,
          delay: 120,
          ease: 'Cubic.Out',
          onComplete: () => banner.destroy(),
        });
      },
    });
  }

  private formatElementLabel(name: string): string {
    const compact = name.replace(/\s+/g, '');
    if (compact.length <= 4) return compact;

    const chunk = compact.length <= 8 ? 4 : 5;
    const lines: string[] = [];
    for (let i = 0; i < compact.length; i += chunk) {
      lines.push(compact.slice(i, i + chunk));
    }

    return lines.slice(0, 2).join('\n');
  }

  private attachElementLabel(image: MatterImage, name: string, radius: number) {
    const fontSize = Phaser.Math.Clamp(Math.floor(radius * 0.45), 9, 24);
    const label = this.add.text(image.x, image.y, this.formatElementLabel(name), {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#0b1020',
      align: 'center',
      stroke: '#f8fafc',
      strokeThickness: Math.max(2, Math.floor(fontSize * 0.22)),
      lineSpacing: -2,
    });

    label.setOrigin(0.5, 0.5);
    label.setDepth(18);

    image.setData('labelRef', label);

    image.once('destroy', () => {
      if (label.active) {
        label.destroy();
      }
    });
  }

  private syncElementLabels() {
    const children = this.children.list as Phaser.GameObjects.GameObject[];

    for (const child of children) {
      const obj = child as unknown as MatterImage;
      if (!obj?.active || !obj.body || !obj.getData) continue;

      const level = Number(obj.getData('level'));
      if (!Number.isFinite(level)) continue;

      const label = obj.getData('labelRef') as Phaser.GameObjects.Text | undefined;
      if (!label || !label.active) continue;

      label.setPosition(obj.x, obj.y);
      label.setRotation(obj.rotation);
    }
  }

  private getMinSettledTopY(): number | null {
    let minY = Number.POSITIVE_INFINITY;

    for (const obj of this.getSettledElements()) {
      const body = obj.body as MatterJS.BodyType;
      const radius = body.circleRadius ?? Number(obj.getData('radius')) ?? 0;
      const topY = body.position.y - radius;

      if (topY < minY) {
        minY = topY;
      }
    }

    return Number.isFinite(minY) ? minY : null;
  }

  private getDangerLevel(timer: number): DangerLevel {
    const ratio = Phaser.Math.Clamp(timer / FAILURE_GRACE_MS, 0, 1);
    if (ratio >= 0.8) return 'CRITICAL';
    if (ratio >= 0.55) return 'DANGER';
    if (ratio >= 0.25) return 'WARNING';
    return 'READY';
  }

  private updateDangerUI() {
    const ratio = Phaser.Math.Clamp(this.dangerTimer / FAILURE_GRACE_MS, 0, 1);
    const level = this.getDangerLevel(this.dangerTimer);

    if (this.dangerLine) {
      this.dangerLine.setAlpha(0.75 + ratio * 0.25);
      this.dangerLine.setFillStyle(
        level === 'DANGER' || level === 'CRITICAL' ? 0xf97316 : 0xef4444,
        0.85 + ratio * 0.15,
      );
    }
  }


  private showGameOverBanner() {
    if (this.gameOverBanner) {
      this.gameOverBanner.destroy();
      this.gameOverBanner = undefined;
    }

    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.44;

    let panelColor = 0x0f172a;
    let panelStroke = 0x67e8f9;
    let titleColor = '#fb7185';
    let titleStroke = '#020617';
    let titleGlow = '#fb7185';
    let titleFont = 'Verdana';
    let tipColor = '#93c5fd';
    let tipFont = 'monospace';

    if (this.comboTheme === 'pixel') {
      panelColor = 0x111827;
      panelStroke = 0x22d3ee;
      titleColor = '#f97316';
      titleGlow = '#f97316';
      titleFont = 'monospace';
      tipColor = '#67e8f9';
      tipFont = 'monospace';
    } else if (this.comboTheme === 'neon') {
      panelColor = 0x090b24;
      panelStroke = 0xf472b6;
      titleColor = '#f472b6';
      titleGlow = '#f472b6';
      titleFont = 'Trebuchet MS';
      tipColor = '#c4b5fd';
      tipFont = 'Trebuchet MS';
    } else {
      panelColor = 0x10243e;
      panelStroke = 0x60a5fa;
      titleColor = '#34d399';
      titleGlow = '#60a5fa';
      titleFont = 'KaiTi';
      tipColor = '#bfdbfe';
      tipFont = 'KaiTi';
    }

    const panel = this.add.rectangle(
      centerX,
      centerY,
      Math.min(360, this.scale.width - 28),
      138,
      panelColor,
      0.8,
    );
    panel.setStrokeStyle(2, panelStroke, 0.68);

    const title = this.add.text(centerX, centerY - 14, 'GAME OVER', {
      fontFamily: titleFont,
      fontSize: '44px',
      fontStyle: 'bold',
      color: titleColor,
      stroke: titleStroke,
      strokeThickness: 8,
    });
    title.setOrigin(0.5, 0.5);
    title.setShadow(0, 0, titleGlow, this.comboTheme === 'neon' ? 24 : 18, true, true);

    const tip = this.add.text(centerX, centerY + 38, 'Tap anywhere to close', {
      fontFamily: tipFont,
      fontSize: '16px',
      color: tipColor,
      stroke: '#020617',
      strokeThickness: 4,
    });
    tip.setOrigin(0.5, 0.5);

    this.gameOverBanner = this.add.container(0, 0, [panel, title, tip]);
    this.gameOverBanner.setDepth(140);
  }

  private dismissGameOverBanner() {
    if (!this.gameOverBanner) return;
    this.gameOverBanner.destroy();
    this.gameOverBanner = undefined;
  }
  private finishGame(reason: 'danger_line') {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isAiming = false;
    this.clearAimVisuals();
    this.showGameOverBanner();

    const payload: GameOverPayload = {
      score: this.currentScore,
      reason,
      maxLevel: this.maxLevelReached,
      mergeCount: this.mergeCount,
    };

    this.game.events.emit('zju:gameOver', payload);
    this.emitDangerState();
    this.emitDebugState();
  }

  private emitScore() {
    this.events.emit('scoreChanged', this.currentScore);
    this.game.events.emit('zju:scoreChanged', this.currentScore);
  }

  private emitDangerState() {
    const payload = {
      isInDanger: this.isInDanger,
      dangerTimer: this.dangerTimer,
      dangerRatio: Phaser.Math.Clamp(this.dangerTimer / FAILURE_GRACE_MS, 0, 1),
      dangerLevel: this.getDangerLevel(this.dangerTimer),
      dangerLineY: this.spawnZoneY,
      propImmunityTimer: this.propImmunityTimer,
    };

    this.events.emit('dangerStateChanged', payload);
    this.game.events.emit('zju:dangerStateChanged', payload);
  }

  private emitDebugState() {
    const next = this.queuedElementType
      ? this.getElementConfigByTextureKey(this.queuedElementType)
      : null;

    const payload = {
      score: this.currentScore,
      comboCount: this.currentComboCount,
      mergeCount: this.mergeCount,
      maxLevel: this.maxLevelReached,
      isGameOver: this.isGameOver,
      dangerElapsedMs: this.dangerTimer,
      dangerRatio: Phaser.Math.Clamp(this.dangerTimer / FAILURE_GRACE_MS, 0, 1),
      failMode: 'buffer',
      canDrop: this.canDrop,
      dropCooldownMs: DROP_COOLDOWN_MS,
      activeProp: this.activeProp,
      propImmunityTimer: this.propImmunityTimer,
      lastSpawnDensity: this.lastSpawnDensity,
      queuedElement: next
        ? {
            level: next.level,
            textureKey: next.textureKey,
            name: next.name,
          }
        : null,
    };

    this.game.events.emit('zju:debugState', payload);
  }
}
