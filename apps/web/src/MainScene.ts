import Phaser from 'phaser';
import {
  BASE_ELEMENT_DENSITY,
  COMBO_WINDOW_MS,
  DANGER_LINE_RATIO,
  DEFAULT_CAT_ART_PACK,
  DROP_LEVEL_UNLOCK_SCORES,
  ELEMENT_DENSITY_DECAY_FACTOR,
  FAILURE_GRACE_MS,
  ZJU_ELEMENTS,
  getCatArtPack,
  getDefaultVariantForLevel,
  getVariantById,
  getVariantsForLevel,
  type CatArtPackId,
  type CatVariantConfig,
  type MatterFeelPreset,
} from './GameConfig';

type MatterImage = Phaser.Physics.Matter.Sprite;
type ActiveProp = 'none' | 'hammer' | 'bomb';
type ComboTheme = 'pixel' | 'neon' | 'campus';
type CatRenderTheme = 'transparent' | 'cream-card';

interface MergeRequest {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  nextLevel: number;
}

interface GameOverPayload {
  score: number;
  reason: 'danger_line';
  maxLevel: number;
  mergeCount: number;
}

interface QueuedElementState {
  level: number;
  name: string;
  variant: CatVariantConfig;
}

type DangerLevel = 'READY' | 'WARNING' | 'DANGER' | 'CRITICAL';

const MAX_LEVEL = 12;
const DROP_COOLDOWN_MS = 700;
const DROP_SPAWN_Y = 60;
const PROP_IMMUNITY_MS = 2000;
const BOMB_KILL_RADIUS = 82;
const BOMB_PUSH_RADIUS = 170;
const SHAKE_MAX_SPEED_X = 7.5;
const SHAKE_MAX_SPEED_Y_UP = -10.5;
const SHAKE_MAX_SPEED_Y_DOWN = 12;
const SHAKE_COOLDOWN_MS = 650;

const PILOT_VARIANT_BADGES: Record<string, string> = {
  'cat-l10-memev1-1': 'P10',
  'cat-l11-memev1-1': 'P11',
  'cat-l12-memev1-1': 'P12',
};

const FALLBACK_CAT_COLORS = [
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
  private queuedElement: QueuedElementState | null = null;
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
  private catRenderTheme: CatRenderTheme = 'cream-card';
  private catArtPackId: CatArtPackId = DEFAULT_CAT_ART_PACK;
  private lastVariantByLevel: Record<number, string | undefined> = {};
  private comboFlashOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverBanner?: Phaser.GameObjects.Container;
  private gameOverBannerDismissAt = 0;

  private dangerLine?: Phaser.GameObjects.Rectangle;

  private worldLeft = 16;
  private worldRight = 16;
  private spawnZoneY = 0;

  private isAiming = false;
  private aimX = 0;
  private aimPreview?: Phaser.GameObjects.Sprite;
  private aimPreviewShell?: Phaser.GameObjects.Arc;
  private aimPreviewBadge?: Phaser.GameObjects.Text;
  private aimGuide?: Phaser.GameObjects.Graphics;
  private pendingMerges: MergeRequest[] = [];
  private shakeCooldownUntil = 0;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.loadCatSourceTextures();
  }

  create() {
    this.resetRuntimeState();

    const w = this.scale.width;
    const h = this.scale.height;
    this.worldRight = w - 16;
    this.spawnZoneY = Math.floor(h * DANGER_LINE_RATIO);

    this.cameras.main.setBackgroundColor('#FDF5E6');
    this.buildCatTextures();

    this.createStaticBounds(w, h);

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
    this.game.events.on('zju:setCatRenderTheme', this.setCatRenderTheme, this);
    this.game.events.on('zju:setCatArtPack', this.setCatArtPack, this);
    this.game.events.on('zju:forceVariantPreview', this.forceVariantPreview, this);
    this.game.events.on('zju:spawnVariantPilot', this.spawnVariantPilot, this);
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
      this.game.events.off('zju:setCatRenderTheme', this.setCatRenderTheme, this);
      this.game.events.off('zju:setCatArtPack', this.setCatArtPack, this);
      this.game.events.off('zju:forceVariantPreview', this.forceVariantPreview, this);
      this.game.events.off('zju:spawnVariantPilot', this.spawnVariantPilot, this);
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

  private resetRuntimeState() {
    this.currentScore = 0;
    this.maxLevelReached = 1;
    this.mergeCount = 0;
    this.queuedElement = null;
    this.currentComboCount = 0;
    this.lastMergeTimestamp = 0;
    this.lastSpawnDensity = 0;
    this.isGameOver = false;
    this.dangerTimer = 0;
    this.isInDanger = false;
    this.canDrop = true;
    this.activeProp = 'none';
    this.propImmunityTimer = 0;
    this.isAiming = false;
    this.aimX = 0;
    this.pendingMerges = [];
    this.shakeCooldownUntil = 0;
    this.catRenderTheme = 'cream-card';
    this.catArtPackId = DEFAULT_CAT_ART_PACK;
    this.lastVariantByLevel = {};
  }
  private createStaticBounds(width: number, height: number) {
    const wallThickness = 32;
    const groundThickness = 48;

    this.matter.add.rectangle(this.worldLeft / 2, height / 2, wallThickness, height, {
      isStatic: true,
      label: 'wall-left',
    });

    this.matter.add.rectangle(width - this.worldLeft / 2, height / 2, wallThickness, height, {
      isStatic: true,
      label: 'wall-right',
    });

    this.matter.add.rectangle(width / 2, height - 16, width - 16, groundThickness, {
      isStatic: true,
      label: 'ground',
    });
  }
  update(_time: number, delta: number) {
    // Keep per-frame work focused on visual overlays only.
    this.syncElementLabels();

    if (this.isGameOver) return;

    if (this.propImmunityTimer > 0) {
      this.propImmunityTimer = Math.max(0, this.propImmunityTimer - delta);
      this.isInDanger = false;
      this.dangerTimer = 0;
      this.processPendingMerges();
      this.containDynamicElements();
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

    this.processPendingMerges();
    this.containDynamicElements();
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
    if (this.time.now < this.shakeCooldownUntil) return;

    this.shakeCooldownUntil = this.time.now + SHAKE_COOLDOWN_MS;
    this.propImmunityTimer = PROP_IMMUNITY_MS;

    const Body = (Phaser.Physics.Matter as any).Matter.Body;
    for (const obj of this.getSettledElements()) {
      const body = obj.body as MatterJS.BodyType;
      Body.applyForce(body, body.position, {
        x: Phaser.Math.FloatBetween(-0.023, 0.023),
        y: Phaser.Math.FloatBetween(-0.075, -0.04),
      });

      const vx = Phaser.Math.Clamp(body.velocity.x, -SHAKE_MAX_SPEED_X, SHAKE_MAX_SPEED_X);
      const vy = Phaser.Math.Clamp(body.velocity.y, SHAKE_MAX_SPEED_Y_UP, SHAKE_MAX_SPEED_Y_DOWN);
      Body.setVelocity(body, { x: vx, y: vy });
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

  public setCatRenderTheme(payload?: { theme?: CatRenderTheme }) {
    const theme = payload?.theme;
    if (theme !== 'transparent' && theme !== 'cream-card') return;
    if (this.catRenderTheme === theme) return;

    this.catRenderTheme = theme;
    this.rebuildCatTexturesForTheme();
    this.emitDebugState();
  }

  public setCatArtPack(payload?: { packId?: CatArtPackId }) {
    const packId = payload?.packId;
    if (!packId || this.catArtPackId === packId) return;

    this.catArtPackId = packId;
    this.lastVariantByLevel = {};
    this.rebuildCatTexturesForTheme();

    const children = this.children.list as Phaser.GameObjects.GameObject[];
    for (const child of children) {
      const obj = child as unknown as MatterImage;
      if (!obj?.active || !obj.body || !obj.getData) continue;

      const level = Number(obj.getData('level'));
      if (!Number.isFinite(level)) continue;

      const nextVariant = this.buildQueuedElement(level).variant;
      obj.setData('variantId', nextVariant.id);
      obj.setData('sourceFile', nextVariant.sourceFile);
      obj.setData('variantKind', nextVariant.kind);
      this.applyVariantVisual(obj, level, nextVariant);
    }

    if (this.queuedElement) {
      this.queuedElement = this.buildQueuedElement(this.queuedElement.level);
      const payload = {
        level: this.queuedElement.level,
        name: this.queuedElement.name,
        variantId: this.queuedElement.variant.id,
        sourceFile: this.queuedElement.variant.sourceFile,
        previewSrc: this.getVariantPreviewSrc(this.queuedElement.variant),
        kind: this.queuedElement.variant.kind,
      };
      this.events.emit('nextElementChanged', payload);
      this.game.events.emit('zju:nextElementChanged', payload);
    }

    this.emitDebugState();
  }

  private rebuildCatTexturesForTheme() {
    this.buildCatTextures();

    const children = this.children.list as Phaser.GameObjects.GameObject[];
    for (const child of children) {
      const obj = child as unknown as MatterImage;
      if (!obj?.active || !obj.body || !obj.getData) continue;

      const variantId = String(obj.getData('variantId') ?? '');
      if (!variantId) continue;

      const level = Number(obj.getData('level'));
      if (!Number.isFinite(level)) continue;
      const variant = this.getVariantByIdOrFallback(level, variantId);
      this.applyVariantVisual(obj, level, variant);
    }

    if (this.aimPreview && this.queuedElement) {
      const radius = this.getElementConfig(this.queuedElement.level).radius;
      this.applyVariantVisual(this.aimPreview, this.queuedElement.level, this.queuedElement.variant);
    }
  }
  public forceVariantPreview(payload?: { level?: number; variantId?: string }) {
    const level = Number(payload?.level);
    const variantId = String(payload?.variantId ?? '');
    if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL || !variantId) return;

    const variant = this.getVariantByIdOrFallback(level, variantId);
    this.queuedElement = {
      level,
      name: this.getElementConfig(level).name,
      variant,
    };
    this.lastVariantByLevel[level] = variant.id;

    const nextPayload = {
      level,
      name: this.queuedElement.name,
      variantId: variant.id,
      sourceFile: variant.sourceFile,
      previewSrc: this.getVariantPreviewSrc(variant),
      kind: variant.kind,
    };

    this.events.emit('nextElementChanged', nextPayload);
    this.game.events.emit('zju:nextElementChanged', nextPayload);
    if (this.isAiming) {
      this.renderAimVisuals();
    }
    this.emitDebugState();
  }

  public spawnVariantPilot(payload?: { level?: number; variantId?: string }) {
    if (this.isGameOver) return;
    const level = Number(payload?.level);
    const variantId = String(payload?.variantId ?? '');
    if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL || !variantId) return;

    const variant = this.getVariantByIdOrFallback(level, variantId);
    const x = Phaser.Math.Clamp(this.scale.width * 0.5, this.worldLeft + this.getElementConfig(level).radius, this.worldRight - this.getElementConfig(level).radius);
    const spawned = this.spawnElement(level, x, DROP_SPAWN_Y + 8, undefined, variant);
    spawned.setVelocity(0, 0.6);
    this.emitDebugState();
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

    if (!this.queuedElement) return;

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

  private containDynamicElements() {
    const Body = (Phaser.Physics.Matter as any).Matter.Body;
    const minX = this.worldLeft + 6;
    const maxX = this.worldRight - 6;
    const minY = 8;
    const maxY = this.scale.height - 18;

    for (const obj of this.getSettledElements()) {
      const body = obj.body as MatterJS.BodyType;
      const radius = body.circleRadius ?? Number(obj.getData('radius')) ?? 0;
      const clampedX = Phaser.Math.Clamp(body.position.x, minX + radius, maxX - radius);
      const clampedY = Phaser.Math.Clamp(body.position.y, minY + radius, maxY - radius);

      if (Math.abs(clampedX - body.position.x) > 0.5 || Math.abs(clampedY - body.position.y) > 0.5) {
        Body.setPosition(body, { x: clampedX, y: clampedY });
      }

      const vx = Phaser.Math.Clamp(body.velocity.x, -SHAKE_MAX_SPEED_X, SHAKE_MAX_SPEED_X);
      const vy = Phaser.Math.Clamp(body.velocity.y, SHAKE_MAX_SPEED_Y_UP, SHAKE_MAX_SPEED_Y_DOWN);
      if (vx !== body.velocity.x || vy !== body.velocity.y) {
        Body.setVelocity(body, { x: vx, y: vy });
      }
    }
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
    if (!this.queuedElement) return;

    const queued = this.getElementConfig(this.queuedElement.level);
    this.aimX = Phaser.Math.Clamp(
      pointerX,
      this.worldLeft + queued.radius,
      this.worldRight - queued.radius,
    );
  }

  private commitDropFromAim() {
    const queued = this.queuedElement;
    this.isAiming = false;

    if (this.isGameOver || !this.canDrop || !queued) {
      this.clearAimVisuals();
      return;
    }

    this.spawnElement(queued.level, this.aimX, DROP_SPAWN_Y, undefined, queued.variant);

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
    const queued = this.queuedElement;
    if (!queued || !this.isAiming || this.activeProp !== 'none') {
      this.clearAimVisuals();
      return;
    }

    const queuedCfg = this.getElementConfig(queued.level);

    if (!this.aimPreview) {
      this.aimPreview = this.add.sprite(this.aimX, DROP_SPAWN_Y, this.getRenderedTextureKey(queued.variant.id));
      this.aimPreview.setDepth(30);
      this.aimPreview.setAlpha(0.7);
    }

    this.applyVariantVisual(this.aimPreview, queued.level, queued.variant);
    this.aimPreview.setPosition(this.aimX, DROP_SPAWN_Y);
    this.syncPilotBadgeForPreview(queued.level, queued.variant.id);

    if (!this.aimGuide) {
      this.aimGuide = this.add.graphics();
      this.aimGuide.setDepth(29);
    }

    this.aimGuide.clear();
    const startY = DROP_SPAWN_Y + queuedCfg.radius + 6;
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
    if (this.aimPreviewBadge) {
      this.aimPreviewBadge.destroy();
      this.aimPreviewBadge = undefined;
    }
  }

  private loadCatSourceTextures() {
    const pack = this.getArtPack();
    for (const variants of Object.values(pack.levelVariants)) {
      for (const variant of variants) {
        const textureKey = this.getCatSourceTextureKey(variant.id);
        if (!this.textures.exists(textureKey)) {
          this.load.image(textureKey, this.getVariantPreviewSrc(variant));
        }

        if (
          variant.kind === 'animated-reserved' &&
          variant.spritesheetKey &&
          variant.frameConfig &&
          !this.textures.exists(variant.spritesheetKey)
        ) {
          this.load.spritesheet(variant.spritesheetKey, '/assets/cats/' + (variant.spritesheetFile ?? variant.sourceFile), {
            frameWidth: variant.frameConfig.frameWidth,
            frameHeight: variant.frameConfig.frameHeight,
          });
        }
      }
    }
  }

  private getArtPack() {
    return getCatArtPack(this.catArtPackId);
  }

  private getVariantPreviewSrc(variant: CatVariantConfig) {
    return `/assets/cats/${variant.previewFile ?? variant.sourceFile}`;
  }

  private getCatSourceTextureKey(variantId: string) {
    return `cat-src-${variantId}`;
  }

  private getRenderedTextureKey(variantId: string, theme: CatRenderTheme = this.catRenderTheme) {
    if (theme === 'transparent') {
      return this.getCatSourceTextureKey(variantId);
    }

    return `${variantId}--${theme}`;
  }

  private getEffectiveRadius(level: number, variant?: CatVariantConfig) {
    const baseRadius = this.getElementConfig(level).radius;
    return variant?.physicsRadiusOverride ?? baseRadius;
  }

  private applyVariantVisual(target: Phaser.GameObjects.Image, level: number, variant: CatVariantConfig) {
    const textureKey = this.getRenderedTextureKey(variant.id);
    const physicsRadius = this.getEffectiveRadius(level, variant);
    const visualRadius = variant.kind === 'animated-reserved' && this.catRenderTheme === 'cream-card' ? Math.round(physicsRadius * 0.72) : (variant.displayRadiusOverride ?? physicsRadius);

    if ('stop' in target && typeof target.stop === 'function') {
      target.stop();
    }

    target.setTexture(textureKey);
    target.setDisplaySize(visualRadius * 2, visualRadius * 2);
    this.syncAnimatedShell(target, physicsRadius, variant);

    if (variant.kind === 'animated-reserved' && 'play' in target && typeof target.play === 'function') {
      const didPrepare = this.ensureVariantAnimation(variant);
      if (didPrepare && variant.animationKey) {
        target.setTexture(variant.spritesheetKey ?? textureKey);
        target.play(variant.animationKey, true);
      }
    }
  }

  private syncAnimatedShell(target: Phaser.GameObjects.Image, physicsRadius: number, variant: CatVariantConfig) {
    const needsShell = this.catRenderTheme === 'cream-card' && variant.kind === 'animated-reserved';

    if (target === this.aimPreview) {
      if (!needsShell) {
        if (this.aimPreviewShell) {
          this.aimPreviewShell.destroy();
          this.aimPreviewShell = undefined;
        }
        return;
      }

      if (!this.aimPreviewShell || !this.aimPreviewShell.active) {
        this.aimPreviewShell = this.add.circle(target.x, target.y, physicsRadius, 0xfff7ed, 0.98);
        this.aimPreviewShell.setStrokeStyle(Math.max(2, Math.floor(physicsRadius * 0.08)), 0xc08457, 0.4);
        this.aimPreviewShell.setDepth(Math.max(0, target.depth - 1));
      }

      this.aimPreviewShell.setRadius(physicsRadius);
      this.aimPreviewShell.setPosition(target.x, target.y);
      this.aimPreviewShell.setDepth(Math.max(0, target.depth - 1));
      return;
    }

    const dataTarget = target as Phaser.GameObjects.Image & { getData?: Function; setData?: Function; once?: Function };
    if (!dataTarget.getData || !dataTarget.setData) return;

    const existingShell = dataTarget.getData('shellRef') as Phaser.GameObjects.Arc | undefined;
    if (!needsShell) {
      if (existingShell?.active) {
        existingShell.destroy();
      }
      dataTarget.setData('shellRef', null);
      return;
    }

    let shell = existingShell;
    if (!shell || !shell.active) {
      shell = this.add.circle(target.x, target.y, physicsRadius, 0xfff7ed, 0.98);
      shell.setStrokeStyle(Math.max(2, Math.floor(physicsRadius * 0.08)), 0xc08457, 0.4);
      shell.setDepth(Math.max(0, target.depth - 1));
      dataTarget.setData('shellRef', shell);
      if (typeof dataTarget.once === 'function') {
        dataTarget.once('destroy', () => {
          const liveShell = dataTarget.getData?.('shellRef') as Phaser.GameObjects.Arc | undefined;
          if (liveShell?.active) {
            liveShell.destroy();
          }
        });
      }
    }

    shell.setRadius(physicsRadius);
    shell.setPosition(target.x, target.y);
    shell.setDepth(Math.max(0, target.depth - 1));
  }

  private ensureVariantAnimation(variant: CatVariantConfig) {
    if (variant.kind !== 'animated-reserved' || !variant.animationKey || !variant.spritesheetKey || !variant.frameConfig) {
      return false;
    }

    if (!this.textures.exists(variant.spritesheetKey)) {
      return false;
    }

    if (this.anims.exists(variant.animationKey)) {
      return true;
    }

    this.anims.create({
      key: variant.animationKey,
      frames: this.anims.generateFrameNumbers(variant.spritesheetKey, {
        start: variant.frameConfig.startFrame ?? 0,
        end: variant.frameConfig.endFrame,
      }),
      frameRate: variant.frameConfig.frameRate ?? 12,
      repeat: variant.frameConfig.repeat ?? -1,
    });

    return true;
  }

  private getLevelVariants(level: number) {
    return getVariantsForLevel(level, this.catArtPackId);
  }

  private pickVariantForLevel(level: number, excludeVariantId?: string | null) {
    const variants = this.getLevelVariants(level);
    if (variants.length === 0) {
      return getDefaultVariantForLevel(level, this.catArtPackId);
    }

    const filtered = variants.filter((variant) => variant.id !== excludeVariantId);
    const pool = filtered.length > 0 ? filtered : variants;
    const totalWeight = pool.reduce((sum, variant) => sum + (variant.weight ?? 1), 0);
    let roll = Math.random() * Math.max(totalWeight, 0.0001);

    for (const variant of pool) {
      roll -= variant.weight ?? 1;
      if (roll <= 0) {
        return variant;
      }
    }

    return pool[pool.length - 1];
  }

  private buildQueuedElement(level: number, excludeVariantId?: string | null): QueuedElementState {
    const variant = this.pickVariantForLevel(level, excludeVariantId ?? this.lastVariantByLevel[level] ?? null);
    this.lastVariantByLevel[level] = variant.id;
    const cfg = this.getElementConfig(level);
    return {
      level,
      name: cfg.name,
      variant,
    };
  }

  private buildCatTextures() {
    if (this.catRenderTheme !== 'cream-card') {
      return;
    }

    const pack = this.getArtPack();
    for (const [levelText, variants] of Object.entries(pack.levelVariants)) {
      const level = Number(levelText);
      const cfg = this.getElementConfig(level);
      for (const variant of variants) {
        this.buildCatTexture(level, variant, this.getRenderedTextureKey(variant.id, 'cream-card'), cfg.radius);
      }
    }
  }

  private buildCatTexture(level: number, variant: CatVariantConfig, textureKey: string, radius: number) {
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    const sourceKey = this.getCatSourceTextureKey(variant.id);
    if (!this.textures.exists(sourceKey)) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    const sourceTexture = this.textures.get(sourceKey);
    const sourceImage = sourceTexture.getSourceImage() as CanvasImageSource | undefined;
    if (!sourceImage) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    const width = Number((sourceImage as { width?: number }).width ?? 0);
    const height = Number((sourceImage as { height?: number }).height ?? 0);
    if (!width || !height) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    tempCtx.clearRect(0, 0, width, height);
    tempCtx.drawImage(sourceImage, 0, 0, width, height);
    const imageData = tempCtx.getImageData(0, 0, width, height).data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    const trimWidth = maxX - minX + 1;
    const trimHeight = maxY - minY + 1;
    const diameter = radius * 2;
    const padding = Math.max(3, Math.floor(diameter * 0.08));
    const innerSize = diameter - padding * 2;
    const scale = Math.min(innerSize / trimWidth, innerSize / trimHeight);
    const drawWidth = Math.max(1, Math.round(trimWidth * scale));
    const drawHeight = Math.max(1, Math.round(trimHeight * scale));
    const offsetX = Math.round((diameter - drawWidth) / 2);
    const offsetY = Math.round((diameter - drawHeight) / 2 + diameter * 0.02);
    const accent = FALLBACK_CAT_COLORS[(level - 1) % FALLBACK_CAT_COLORS.length];
    const r = (accent >> 16) & 255;
    const g = (accent >> 8) & 255;
    const b = accent & 255;

    const canvasTexture = this.textures.createCanvas(textureKey, diameter, diameter);
    if (!canvasTexture) {
      this.ensureFallbackCatTexture(textureKey, radius, level);
      return;
    }

    const ctx = canvasTexture.context;

    ctx.clearRect(0, 0, diameter, diameter);

    const bgGradient = ctx.createRadialGradient(
      radius * 0.72,
      radius * 0.62,
      Math.max(2, radius * 0.18),
      radius,
      radius,
      radius,
    );
    bgGradient.addColorStop(0, 'rgba(255,250,242,0.98)');
    bgGradient.addColorStop(0.68, `rgba(${r}, ${g}, ${b}, 0.22)`);
    bgGradient.addColorStop(1, 'rgba(245, 232, 212, 0.96)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = bgGradient;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius + radius * 0.08, radius * 0.82, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 72, 24, 0.12)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sourceImage, minX, minY, trimWidth, trimHeight, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 1.5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.lineWidth = Math.max(2, diameter * 0.035);
    ctx.strokeStyle = 'rgba(122, 74, 31, 0.22)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius * 0.72, radius * 0.56, radius * 0.18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.restore();

    canvasTexture.refresh();
  }

  private ensureFallbackCatTexture(textureKey: string, radius: number, level: number) {
    if (this.textures.exists(textureKey)) return;

    const size = radius * 2;
    const g = this.add.graphics({ x: -9999, y: -9999 });
    const color = FALLBACK_CAT_COLORS[(level - 1) % FALLBACK_CAT_COLORS.length];

    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.lineStyle(3, 0x1f2937, 0.95);
    g.strokeCircle(radius, radius, radius - 1);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(radius - Math.floor(radius * 0.28), radius - Math.floor(radius * 0.18), Math.max(3, Math.floor(radius * 0.12)));
    g.fillCircle(radius + Math.floor(radius * 0.28), radius - Math.floor(radius * 0.18), Math.max(3, Math.floor(radius * 0.12)));
    g.fillStyle(0x111827, 1);
    g.fillCircle(radius - Math.floor(radius * 0.26), radius - Math.floor(radius * 0.16), Math.max(2, Math.floor(radius * 0.06)));
    g.fillCircle(radius + Math.floor(radius * 0.26), radius - Math.floor(radius * 0.16), Math.max(2, Math.floor(radius * 0.06)));
    g.lineStyle(2, 0x111827, 0.9);
    g.beginPath();
    g.moveTo(radius - Math.floor(radius * 0.2), radius + Math.floor(radius * 0.18));
    g.lineTo(radius, radius + Math.floor(radius * 0.28));
    g.lineTo(radius + Math.floor(radius * 0.2), radius + Math.floor(radius * 0.18));
    g.strokePath();

    g.generateTexture(textureKey, size, size);
    g.destroy();
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

  private getVariantByIdOrFallback(level: number, variantId: string) {
    return getVariantById(variantId, this.catArtPackId) ?? getDefaultVariantForLevel(level, this.catArtPackId);
  }

  private getUnlockedDropLevelByScore(score: number) {

    let unlockedLevel = 1;

    for (let i = DROP_LEVEL_UNLOCK_SCORES.length - 1; i >= 0; i -= 1) {
      if (score >= DROP_LEVEL_UNLOCK_SCORES[i]) {
        unlockedLevel = i + 1;
        break;
      }
    }

    return Phaser.Math.Clamp(Math.max(2, unlockedLevel), 2, Math.min(MAX_LEVEL, 8));
  }

  private pickNextDropLevel(maxLevel: number) {
    const cappedLevel = Phaser.Math.Clamp(maxLevel, 2, MAX_LEVEL);
    const weights: number[] = [];
    let totalWeight = 0;

    for (let level = 1; level <= cappedLevel; level += 1) {
      const lowPeak = Math.pow(0.66, level - 1);
      const highPeak = 0.58 * Math.pow(0.72, cappedLevel - level);
      const weight = lowPeak + highPeak;
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
    const nextQueued = this.buildQueuedElement(nextLevel);
    this.queuedElement = nextQueued;

    const payload = {
      level: nextQueued.level,
      name: nextQueued.name,
      variantId: nextQueued.variant.id,
      sourceFile: nextQueued.variant.sourceFile,
      previewSrc: this.getVariantPreviewSrc(nextQueued.variant),
      kind: nextQueued.variant.kind,
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

  private spawnElement(level: number, x: number, y: number, feel?: MatterFeelPreset, variant?: CatVariantConfig): MatterImage {
    const actualFeel = feel ?? this.getFeel();
    const cfg = this.getElementConfig(level);
    const chosenVariant = variant ?? this.buildQueuedElement(level).variant;
    const effectiveRadius = this.getEffectiveRadius(level, chosenVariant);
    const dynamicDensity = this.computeDensityForLevel(level, actualFeel);

    const physicsOptions = {
      shape: { type: 'circle', radius: effectiveRadius },
      friction: actualFeel.friction,
      frictionAir: actualFeel.frictionAir,
      frictionStatic: actualFeel.frictionStatic,
      restitution: actualFeel.restitution,
      density: dynamicDensity,
      label: `zju-level-${level}`,
    };

    const image = this.matter.add.sprite(
      x,
      y,
      this.getRenderedTextureKey(chosenVariant.id),
      undefined,
      physicsOptions,
    ) as MatterImage;

    this.applyVariantVisual(image, level, chosenVariant);

    image.setBounce(actualFeel.restitution);
    image.setFriction(actualFeel.friction, actualFeel.frictionAir, actualFeel.frictionStatic);
    image.setDensity(dynamicDensity);
    image.setDepth(20);
    image.setDataEnabled();
    image.setData('level', level);
    image.setData('variantId', chosenVariant.id);
    image.setData('sourceFile', chosenVariant.sourceFile);
    image.setData('variantKind', chosenVariant.kind);
    image.setData('radius', effectiveRadius);
    image.setData('merged', false);
    image.setData('isMerging', false);
    image.setData('isSettled', false);

    this.lastSpawnDensity = dynamicDensity;

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

    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      this.markElementSettled(bodyA);
      this.markElementSettled(bodyB);

      if (!bodyA.gameObject || !bodyB.gameObject) {
        continue;
      }

      const a = bodyA.gameObject as MatterImage;
      const b = bodyB.gameObject as MatterImage;

      if (!a.active || !b.active) continue;
      if (a.getData('merged') || b.getData('merged')) continue;
      if (a.getData('isMerging') || b.getData('isMerging')) continue;

      const levelA = Number(a.getData('level'));
      const levelB = Number(b.getData('level'));
      if (!Number.isFinite(levelA) || !Number.isFinite(levelB)) continue;
      if (levelA !== levelB || levelA >= MAX_LEVEL) continue;

      const idA = bodyA.id;
      const idB = bodyB.id;
      if (reservedBodyIds.has(idA) || reservedBodyIds.has(idB)) continue;

      a.setData('isMerging', true);
      b.setData('isMerging', true);
      reservedBodyIds.add(idA);
      reservedBodyIds.add(idB);

      this.pendingMerges.push({
        bodyA,
        bodyB,
        nextLevel: levelA + 1,
      });
    }
  }

  private processPendingMerges() {
    if (this.pendingMerges.length === 0 || this.isGameOver) {
      this.pendingMerges = [];
      return;
    }

    const merges = this.pendingMerges;
    this.pendingMerges = [];

    for (const merge of merges) {
      this.executeMerge(merge);
    }
  }

  private executeMerge(merge: MergeRequest) {
    const { bodyA, bodyB, nextLevel } = merge;
    const a = bodyA.gameObject as MatterImage | undefined;
    const b = bodyB.gameObject as MatterImage | undefined;

    if (!a || !b || !a.active || !b.active) return;

    const x = (bodyA.position.x + bodyB.position.x) / 2;
    const y = (bodyA.position.y + bodyB.position.y) / 2;

    a.setData('merged', true);
    b.setData('merged', true);

    a.destroy();
    b.destroy();

    const nextVariant = this.buildQueuedElement(nextLevel, String(a.getData('variantId') ?? '')).variant;
    const merged = this.spawnElement(nextLevel, x, y - 2, undefined, nextVariant);
    merged.setVelocity((Math.random() - 0.5) * 1.2, -4.2);
    this.playMergePopVisual(nextLevel, nextVariant.id, x, y - 2);

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

  private playMergePopVisual(level: number, variantId: string, x: number, y: number) {
    const cfg = this.getElementConfig(level);
    const variant = this.getVariantByIdOrFallback(level, variantId);
    const pop = this.add.sprite(x, y, this.getRenderedTextureKey(variantId));
    this.applyVariantVisual(pop, level, variant);
    pop.setDepth(45);
    pop.setAlpha(0.88);
    pop.setScale(0.5);

    this.tweens.add({
      targets: pop,
      scale: 1,
      alpha: 0,
      duration: 250,
      ease: 'Back.Out',
      onComplete: () => pop.destroy(),
    });
  }
  private showComboFloatingText(x: number, y: number, comboCount: number, bonusScore: number) {

    if (comboCount <= 1) return;

    const text = this.add.text(x - 22, y - 26, `Combo x${comboCount}\n+${bonusScore}`, {
      color: '#fff7ed',
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: '15px',
      align: 'center',
      stroke: '#7c2d12',
      strokeThickness: 5,
      lineSpacing: -2,
    });
    text.setDepth(50);
    text.setShadow(0, 4, '#fb923c', 12, false, true);
    text.setScale(0.72);
    text.setAlpha(0);

    this.tweens.add({
      targets: text,
      y: y - 62,
      alpha: 1,
      scale: 1.06,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: text,
          y: y - 78,
          alpha: 0,
          scale: 0.92,
          duration: 180,
          ease: 'Cubic.In',
          onComplete: () => text.destroy(),
        });
      },
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
    let color = '#fde68a';
    let size = 34;
    let stroke = '#7c2d12';
    let glow = '#fdba74';
    let fontFamily = 'Arial Rounded MT Bold, Trebuchet MS, sans-serif';

    if (comboCount >= 6) {
      title = 'MEGA COMBO x' + comboCount;
      color = '#f9a8d4';
      size = 44;
      glow = '#f472b6';
    } else if (comboCount >= 4) {
      title = 'SUPER COMBO x' + comboCount;
      color = '#fdba74';
      size = 39;
      glow = '#fb923c';
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
      strokeThickness: 9,
      lineSpacing: 6,
    });
    banner.setOrigin(0.5, 0.5);
    banner.setDepth(120);
    banner.setAlpha(0);
    banner.setShadow(0, 6, glow, 18, false, true);

    const maxBannerWidth = this.scale.width * 0.86;
    const fitRatio = banner.width > maxBannerWidth ? maxBannerWidth / banner.width : 1;
    const startScale = 0.5 * fitRatio;
    const peakScale = 1.12 * fitRatio;
    const endScale = 0.94 * fitRatio;
    banner.setScale(startScale);

    this.tweens.add({
      targets: banner,
      alpha: 0.98,
      scale: peakScale,
      y: centerY,
      duration: 180,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          scale: endScale,
          y: centerY - 18,
          duration: 170,
          ease: 'Cubic.In',
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

  private getPilotBadgeText(variantId: string | null | undefined) {
    return variantId ? PILOT_VARIANT_BADGES[variantId] ?? null : null;
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

    const pilotBadgeText = this.getPilotBadgeText(String(image.getData('variantId') ?? ''));
    if (pilotBadgeText) {
      const badge = this.add.text(image.x, image.y, pilotBadgeText, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(10, Math.floor(radius * 0.34))}px`,
        color: '#7c2d12',
        fontStyle: 'bold',
        stroke: '#fff7ed',
        strokeThickness: 3,
        backgroundColor: '#fde68a',
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      });
      badge.setOrigin(0.5, 0.5);
      badge.setDepth(22);
      image.setData('pilotBadgeRef', badge);
    }

    image.once('destroy', () => {
      if (label.active) {
        label.destroy();
      }
      const badge = image.getData('pilotBadgeRef') as Phaser.GameObjects.Text | undefined;
      if (badge?.active) {
        badge.destroy();
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

      const shell = obj.getData('shellRef') as Phaser.GameObjects.Arc | undefined;
      if (shell?.active) {
        const radius = Number(obj.getData('radius')) || 0;
        shell.setPosition(obj.x, obj.y);
        shell.setDepth(Math.max(0, obj.depth - 1));
        shell.setRadius(radius);
      }

      const badge = obj.getData('pilotBadgeRef') as Phaser.GameObjects.Text | undefined;
      if (badge?.active) {
        const radius = Number(obj.getData('radius')) || 0;
        badge.setPosition(obj.x + radius * 0.46, obj.y - radius * 0.48);
      }
    }
  }

  private syncPilotBadgeForPreview(level: number, variantId: string) {
    const badgeText = this.getPilotBadgeText(variantId);
    if (!badgeText) {
      if (this.aimPreviewBadge) {
        this.aimPreviewBadge.destroy();
        this.aimPreviewBadge = undefined;
      }
      return;
    }

    if (!this.aimPreviewBadge) {
      this.aimPreviewBadge = this.add.text(0, 0, badgeText, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(11, Math.floor(this.getElementConfig(level).radius * 0.34))}px`,
        color: '#7c2d12',
        fontStyle: 'bold',
        stroke: '#fff7ed',
        strokeThickness: 3,
        backgroundColor: '#fde68a',
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      });
      this.aimPreviewBadge.setOrigin(0.5, 0.5);
      this.aimPreviewBadge.setDepth(31);
    }

    this.aimPreviewBadge.setText(badgeText);
    const radius = this.getElementConfig(level).radius;
    this.aimPreviewBadge.setPosition(this.aimX + radius * 0.46, DROP_SPAWN_Y - radius * 0.48);
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
      panelColor = 0xfff7ed;
      panelStroke = 0xfb923c;
      titleColor = '#fb923c';
      titleGlow = '#fdba74';
      titleFont = 'Arial Rounded MT Bold';
      tipColor = '#7c2d12';
      tipFont = 'Trebuchet MS';
    } else if (this.comboTheme === 'neon') {
      panelColor = 0xfff1f2;
      panelStroke = 0xfb7185;
      titleColor = '#fb7185';
      titleGlow = '#f9a8d4';
      titleFont = 'Arial Rounded MT Bold';
      tipColor = '#9f1239';
      tipFont = 'Trebuchet MS';
    } else {
      panelColor = 0xfffbeb;
      panelStroke = 0xf59e0b;
      titleColor = '#f59e0b';
      titleGlow = '#fdba74';
      titleFont = 'Arial Rounded MT Bold';
      tipColor = '#78350f';
      tipFont = 'Trebuchet MS';
    }

    const panel = this.add.rectangle(
      centerX,
      centerY,
      Math.min(360, this.scale.width - 28),
      138,
      panelColor,
      0.92,
    );
    panel.setStrokeStyle(3, panelStroke, 0.92);

    const title = this.add.text(centerX, centerY - 14, 'GAME OVER', {
      fontFamily: titleFont,
      fontSize: '46px',
      fontStyle: 'bold',
      color: titleColor,
      stroke: titleStroke,
      strokeThickness: 10,
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
    this.activeProp = 'none';
    this.propImmunityTimer = 0;
    this.pendingMerges = [];
    this.canDrop = false;
    this.clearAimVisuals();
    this.game.events.emit('zju:activePropChanged', { activeProp: this.activeProp });
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
    const next = this.queuedElement;

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
      catRenderTheme: this.catRenderTheme,
      catArtPackId: this.catArtPackId,
      lastSpawnDensity: this.lastSpawnDensity,
      queuedElement: next
        ? {
            level: next.level,
            name: next.name,
            variantId: next.variant.id,
            sourceFile: next.variant.sourceFile,
            previewSrc: this.getVariantPreviewSrc(next.variant),
            kind: next.variant.kind,
          }
        : null,
    };

    this.game.events.emit('zju:debugState', payload);
  }
}
