// src/models/MilitaryUnit.js
// ------------------------------------------------------------
// 兵种系统核心数据模型（折中优化版）
// - 不在类中存储 "hexId" / "forcesList" 静态字段
// - 关联由 HexForceMapper 统一管理
// ------------------------------------------------------------

import { HexForceMapper } from '@/utils/HexForceMapper';
import { openGameStore } from '@/store';
import { MilitaryConfig } from '@/config/GameConfig';
import { Unit } from './MilitaryUnit';

const store = openGameStore();

/* ===================================================================
 * Ⅰ. Unit  (兵种模板，可被多个 Force 引用)
 * -------------------------------------------------------------------*/
export class Unit {
  static _autoId = 1;
  static _registry = new Map();

  static create(options) {
    if (Unit._registry.has(options.unitTypeId)) {
      return Unit._registry.get(options.unitTypeId);
    }
    const unit = new Unit(options);
    Unit._registry.set(unit.unitTypeId, unit);
    return unit;
  }

  static get(unitTypeId) {
    return Unit._registry.get(unitTypeId);
  }

  constructor({
    unitTypeId,
    unitName,
    service,
    category,
    unitAvailability,
    attackPowerComposition,
    defensePowerComposition,
    visibilityRadius,
    actionPointComposition,
    recoveryRate,
    commandCapability = 0,
    commandRange = 0,
  }) {
    this.unitTypeId = unitTypeId ?? `U_${Unit._autoId++}`;
    this.unitName = unitName;
    this.service = service;
    this.category = category;
    this.unitAvailability = unitAvailability;
    this.attackPowerComposition = attackPowerComposition;
    this.defensePowerComposition = defensePowerComposition;
    this.visibilityRadius = visibilityRadius;
    this.actionPointComposition = actionPointComposition;
    this.recoveryRate = recoveryRate;
    this.commandCapability = commandCapability;
    this.commandRange = commandRange;
  }

  getAttackPower(terrainType) {
    const { baseAttackPower, domainFactor, terrainFactor } = this.attackPowerComposition;
    const tf = terrainFactor[terrainType] ?? 1;
    return {
      land: baseAttackPower * domainFactor.land * tf,
      sea: baseAttackPower * domainFactor.sea * tf,
      air: baseAttackPower * domainFactor.air * tf,
    };
  }

  getDefensePower(terrainType) {
    const { baseDefensePower, domainFactor, terrainFactor } = this.defensePowerComposition;
    const tf = terrainFactor[terrainType] ?? 1;
    return {
      land: baseDefensePower * domainFactor.land * tf,
      sea: baseDefensePower * domainFactor.sea * tf,
      air: baseDefensePower * domainFactor.air * tf,
    };
  }

  getActionPointCost(terrainType) {
    const { baseActionPointCost, terrainFactor } = this.actionPointComposition;
    const tf = terrainFactor[terrainType] ?? 1;
    return baseActionPointCost * tf;
  }

  toPlainObject() {
    return {
      unitTypeId: this.unitTypeId,
      unitName: this.unitName,
      service: this.service,
      category: this.category,
      unitAvailability: this.unitAvailability,
      attackPowerComposition: this.attackPowerComposition,
      defensePowerComposition: this.defensePowerComposition,
      visibilityRadius: this.visibilityRadius,
      actionPointComposition: this.actionPointComposition,
      recoveryRate: this.recoveryRate,
      commandCapability: this.commandCapability,
      commandRange: this.commandRange,
    };
  }

  static fromPlainObject(obj) {
    return Unit.create(obj);
  }
}

/* ===================================================================
 * Ⅱ. Force  (部队)
 * -------------------------------------------------------------------*/
export class Force {
  static _autoId = 1;

  constructor({
    forceId,
    forceName,
    faction,
    service,
    composition, // [{ unitTypeId, unitCount }]
  }) {
    this.forceId = forceId ?? `F_${Force._autoId++}`;
    this.forceName = forceName;
    this.faction = faction;
    this.service = service;
    this.composition = composition;
    // 初始化动态值
    this.troopStrength = MilitaryConfig.limit.maxTroopStrength;
    this.actionPoints = MilitaryConfig.limit.actionPointsPerTurn;
  }

  /* 位置关联 */
  get hexId() {
    return HexForceMapper.getHexByForceId(this.forceId);
  }

  set hexId(newHexId) {
    HexForceMapper.moveForceToHex(this.forceId, newHexId);
  }

  /* 计算恢复速率：疲劳系数 × ∑单位恢复能力 */
  get computedRecoveryRate() {
    const sumRate = this.composition.reduce((sum, c) => {
      const unit = Unit.get(c.unitTypeId);
      return sum + (unit?.recoveryRate ?? 0) * c.unitCount;
    }, 0);
    const ft = MilitaryConfig.limit.fatigueFactor;
    const rem = this.remainingCombatTimes;
    const fatigue = rem === -1 ? ft.levelOne : rem === -2 ? ft.levelTwo : 1;
    return sumRate * fatigue;
  }

  /* 手动更新兵力：下回合调用 */
  updateTroopStrength() {
    this.troopStrength = Math.min(
      MilitaryConfig.limit.maxTroopStrength,
      this.troopStrength + this.computedRecoveryRate
    );
    return this.troopStrength;
  }

  /* 手动重置行动力：下回合开始时调用 */
  resetActionPoints() {
    this.actionPoints = MilitaryConfig.limit.actionPointsPerTurn;
    return this.actionPoints;
  }

  /* 消耗行动力 */
  consumeActionPoints(cost) {
    this.actionPoints = Math.max(0, this.actionPoints - cost);
    return this.actionPoints;
  }

  /* 路径耗费并扣减 */
  executeMovePath(hexPath = []) {
    const cost = this.computeActionPointsForPath(hexPath);
    this.consumeActionPoints(cost);
    return cost;
  }

  /* 当前地形类型 */
  _currentTerrain() {
    const cell = store.getHexCells().find(h => h.hexId === this.hexId);
    return cell?.terrainAttributes.terrainType ?? 'plain';
  }

  /* ========= 动态计算属性 ========= */
  get morale() {
    return Math.min(
      MilitaryConfig.limit.minMorale === 50 ? 100 : 100,
      Math.max(
        MilitaryConfig.limit.minMorale,
        (100 - 0.5 * (100 - this.troopStrength)) * this.commandCapability
      )
    );
  }

  get visibilityRadius() {
    return Math.max(
      ...this.composition.map(c => Unit.get(c.unitTypeId)?.visibilityRadius ?? 0)
    );
  }

  get commandCapability() {
    return Math.max(
      1,
      ...this.composition.map(c => Unit.get(c.unitTypeId)?.commandCapability ?? 0)
    );
  }

  get commandRange() {
    return Math.max(
      0,
      ...this.composition.map(c => Unit.get(c.unitTypeId)?.commandRange ?? 0)
    );
  }

  get attackFirepower() {
    const terrain = this._currentTerrain();
    const totals = { land: 0, sea: 0, air: 0 };
    this.composition.forEach(c => {
      const unit = Unit.get(c.unitTypeId);
      if (!unit) return;
      const p = unit.getAttackPower(terrain);
      totals.land += p.land * c.unitCount;
      totals.sea += p.sea * c.unitCount;
      totals.air += p.air * c.unitCount;
    });
    totals.land *= this.morale / 100;
    totals.sea *= this.morale / 100;
    totals.air *= this.morale / 100;
    return totals;
  }

  get defenseFirepower() {
    const terrain = this._currentTerrain();
    const totals = { land: 0, sea: 0, air: 0 };
    this.composition.forEach(c => {
      const unit = Unit.get(c.unitTypeId);
      if (!unit) return;
      const p = unit.getDefensePower(terrain);
      totals.land += p.land * c.unitCount;
      totals.sea += p.sea * c.unitCount;
      totals.air += p.air * c.unitCount;
    });
    totals.land *= this.morale / 100;
    totals.sea *= this.morale / 100;
    totals.air *= this.morale / 100;
    return totals;
  }

  /* 当前格最大行动力消耗 */
  get actionPointCost() {
    const terrain = this._currentTerrain();
    return Math.max(
      ...this.composition.map(c => Unit.get(c.unitTypeId)?.getActionPointCost(terrain) ?? 0)
    );
  }

  computeActionPointsForPath(hexPath = []) {
    return hexPath.reduce((sum, hexId) => {
      const cell = store.getHexCells().find(h => h.hexId === hexId);
      const terr = cell?.terrainAttributes.terrainType ?? 'plain';
      const stepCost = Math.max(
        ...this.composition.map(c => Unit.get(c.unitTypeId)?.getActionPointCost(terr) ?? 0)
      );
      return sum + stepCost;
    }, 0);
  }

  /* ---------- PlainObject 序列化 ---------- */
  toPlainObject() {
    return {
      forceId: this.forceId,
      forceName: this.forceName,
      faction: this.faction,
      service: this.service,
      composition: this.composition,
      troopStrength: this.troopStrength,
      actionPoints: this.actionPoints,
      remainingCombatTimes: this.remainingCombatTimes,
    };
  }

  static fromPlainObject(obj) {
    const f = new Force(obj);
    f.troopStrength = obj.troopStrength;
    f.actionPoints = obj.actionPoints;
    f.remainingCombatTimes = obj.remainingCombatTimes;
    return f;
  }
}

/* ===================================================================
 * Ⅲ. BattleGroup
 * -------------------------------------------------------------------*/
export class BattleGroup {
  static _autoId = 1;

  constructor({ battlegroupId, faction, commandForceId, forcesList }) {
    this.battlegroupId = battlegroupId ?? `BG_${BattleGroup._autoId++}`;
    this.faction = faction;
    this.commandForceId = commandForceId;
    this.forcesList = forcesList;
  }

  _forces() {
    return this.forcesList.map(fid => store.getForce(fid)).filter(Boolean);
  }

  get commandCapability() {
    const cmd = store.getForce(this.commandForceId);
    return cmd?.commandCapability ?? 1;
  }

  get jointAttackFirepower() {
    const totals = { land: 0, sea: 0, air: 0 };
    this._forces().forEach(f => {
      const p = f.attackFirepower;
      totals.land += p.land;
      totals.sea += p.sea;
      totals.air += p.air;
    });
    totals.land *= this.commandCapability;
    totals.sea *= this.commandCapability;
    totals.air *= this.commandCapability;
    return totals;
  }

  get jointDefenseFirepower() {
    const totals = { land: 0, sea: 0, air: 0 };
    this._forces().forEach(f => {
      const p = f.defenseFirepower;
      totals.land += p.land;
      totals.sea += p.sea;
      totals.air += p.air;
    });
    totals.land *= this.commandCapability;
    totals.sea *= this.commandCapability;
    totals.air *= this.commandCapability;
    return totals;
  }

  toPlainObject() {
    return {
      battlegroupId: this.battlegroupId,
      faction: this.faction,
      commandForceId: this.commandForceId,
      forcesList: this.forcesList,
    };
  }

  static fromPlainObject(obj) {
    return new BattleGroup(obj);
  }
}

/* ===================================================================
 * Ⅳ. Formation
 * -------------------------------------------------------------------*/
export class Formation {
  static _autoId = 1;

  constructor({ formationId, formationName, faction, forcesList }) {
    this.formationId = formationId ?? `FM_${Formation._autoId++}`;
    this.formationName = formationName;
    this.faction = faction;
    this.forcesList = forcesList;
  }

  get totalTroopStrength() {
    return this.forcesList.reduce((sum, fid) => {
      const f = store.getForce(fid);
      return sum + (f?.troopStrength ?? 0);
    }, 0);
  }

  toPlainObject() {
    return {
      formationId: this.formationId,
      formationName: this.formationName,
      faction: this.faction,
      forcesList: this.forcesList,
    };
  }

  static fromPlainObject(obj) {
    return new Formation(obj);
  }
}
