// src/models/MilitaryUnit.js
// ============================================================
// 兵种系统核心数据模型
// ------------------------------------------------------------
// 说明：
//   • Unit    —— 兵种模板（同一个兵种实例可被多个 Force 引用）
//   • Force   —— 部队（地图上渲染实体）
//   • Battlegroup —— 战斗群（临时联合体）
//   • Formation    —— 编队（管理分组）
//
//   * 部队‑六角格、部队‑编队 等关联全部由 HexForceMapper 维护。
// ============================================================

import { HexForceMapper }   from '@/layers/interaction-layer/utils/HexForceMapper';
import { openGameStore }    from '@/store';
import { MilitaryConfig }   from '@/config/GameConfig';

/* ===================================================================
 * Ⅰ. Unit  (兵种)
 * -------------------------------------------------------------------*/
export class Unit {
  static #autoId = 1; // 自动递增 id
  
  /** 创建或修改兵种 */
  static create(data) {
    const store = openGameStore();
    const existing = store.getUnitById(data.unitId);
    if (existing) {
      // 更新现有兵种的属性
      if (data.unitName !== undefined) existing.unitName = data.unitName;
      if (data.service !== undefined) existing.service = data.service;
      if (data.category !== undefined) existing.category = data.category;
      if (data.factionAvailability !== undefined) existing.factionAvailability = { ...data.factionAvailability };
      if (data.attackPowerComposition !== undefined) existing.attackPowerComposition = { ...data.attackPowerComposition };
      if (data.defensePowerComposition !== undefined) existing.defensePowerComposition = { ...data.defensePowerComposition };
      if (data.visibilityRadius !== undefined) existing.visibilityRadius = data.visibilityRadius;
      if (data.actionPointCostComposition !== undefined) existing.actionPointCostComposition = { ...data.actionPointCostComposition };
      if (data.recoveryRate !== undefined) existing.recoveryRate = data.recoveryRate;
      if (data.commandCapability !== undefined) existing.commandCapability = data.commandCapability;
      if (data.commandRange !== undefined) existing.commandRange = data.commandRange;
      return existing;
    }
    const u = new Unit(data);
    store.addUnit(u);
    return u;
  }

  /** 委托给 Pinia */
  static getById(id) {
    return openGameStore().getUnitById(id);
  }

  constructor({
    // ===== Identification =====
    unitId, unitName, service, category, factionAvailability,
    // ===== Combat Attributes =====
    attackPowerComposition, defensePowerComposition,
    // ===== Survival Attributes =====
    visibilityRadius, actionPointCostComposition, recoveryRate,
    // ===== Command Attributes =====
    commandCapability = 1, commandRange = 1,
    // ===== Rendering Attributes =====
    renderingKey = ""
  }) {
    this.unitId = unitId ?? `U_${Unit.#autoId++}`; // 兵种id
    this.unitName = unitName; // 兵种名称
    this.service = service; // 军种，这是一个数组，一个兵种可能属于多个军种 - sea, land, air
    this.category = category; // 兵种类型
    this.factionAvailability = factionAvailability; // 可参战阵营，是一个数组
    this.attackPowerComposition = attackPowerComposition; // 攻击力
    this.defensePowerComposition = defensePowerComposition; // 防御力
    this.visibilityRadius = visibilityRadius; // 可视范围
    this.actionPointCostComposition = actionPointCostComposition; // 行动力消耗
    this.recoveryRate = recoveryRate; // 恢复速率
    this.commandCapability = commandCapability; // 指挥能力
    this.commandRange = commandRange; // 指挥范围
    this.renderingKey = renderingKey; // 渲染关键字
  }

  /* ==================== 作战/行动相关属性动态计算 ===================== */
  getAttackPower(terrain) {
    const { baseAttackPower, domainFactor, terrainFactor } = this.attackPowerComposition;
    const tf = terrainFactor[terrain] ?? 1;
    return {
      land: baseAttackPower * domainFactor.land * tf,
      sea : baseAttackPower * domainFactor.sea  * tf,
      air : baseAttackPower * domainFactor.air  * tf,
    };
  }

  getDefensePower(terrain) {
    const { baseDefensePower, domainFactor, terrainFactor } = this.defensePowerComposition;
    const tf = terrainFactor[terrain] ?? 1;
    return {
      land: baseDefensePower * domainFactor.land * tf,
      sea : baseDefensePower * domainFactor.sea  * tf,
      air : baseDefensePower * domainFactor.air  * tf,
    };
  }

  getActionPointCost(terrain) {
    const { baseActionPointCost, terrainFactor } = this.actionPointCostComposition;
    return baseActionPointCost * (terrainFactor[terrain] ?? 1);
  }

  /* ======================== 序列化 =========================== */
  toPlainObject() {
    return {
      unitId: this.unitId,
      unitName: this.unitName,
      service: this.service,
      category: this.category,
      factionAvailability: this.factionAvailability,
      attackPowerComposition: this.attackPowerComposition,
      defensePowerComposition: this.defensePowerComposition,
      visibilityRadius: this.visibilityRadius,
      actionPointCostComposition: this.actionPointCostComposition,
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
  static #autoId = 1;

  constructor({ 
    forceId, forceName, faction, service, hexId,
    composition,
    troopStrength = MilitaryConfig.limit.maxTroopStrength,
    combatChance = 0,
    actionPoints = 0
  }) {
    this.forceId   = forceId ?? `F_${Force.#autoId++}`;
    this.forceName = forceName;
    this.faction   = faction; // 阵营，是一个字符串，一个部队只能属于一个阵营
    this.service   = service; // 军种，是一个字符串，一个部队只能属于一个军种 - sea, land, air
    this.hexId = hexId; // updated from HexForceMapper

    // 兵种组成：[{ unitId, unitCount }]
    this.composition = composition;

    this.troopStrength = Math.min(MilitaryConfig.limit.maxTroopStrength, 
                                Math.max(0, troopStrength || 0));
    // this.morale = get from troopStrength, commandCapability;
    // this.attackFirepower  = get from Unit.attackPower , unitCount, morale;
    // this.defenseFirepower = get from Unit.defensePower, unitCount, morale;
    this.combatChance = Math.min(MilitaryConfig.limit.combatChance.max, 
                                Math.max(MilitaryConfig.limit.combatChance.min, combatChance)); 
    // this.fatigueFactor = get from combatChance;

    // this.visibilityRadius = get from Unit.visibilityRadius;
    this.actionPoints = Math.min(MilitaryConfig.limit.maxActionPoints, 
                                Math.max(0, actionPoints || 0)); 
    // this.recoveryRate = get from Unit.recoveryRate, fatigueFactor;

    // this.commandCapability = get from Unit.commandCapability;
    // this.commandRange = get from Unit.commandRange;
  }

  /* ======================== 动态计算属性 =========================== */
  // 部队所在六角格
  get hexId() { return HexForceMapper.getHexByForceId(this.forceId); }
  set hexId(newHex) { HexForceMapper.moveForceToHex(this.forceId, newHex); }

  // 士气值
  get morale() {
    const base = 100 - 0.5 * (100 - this.troopStrength);
    return Math.min(100, Math.max(MilitaryConfig.limit.minMorale, base * this.commandCapability));
  }

  // 进攻火力值
  get attackFirepower()  { return this._getFirepower('attackPower'); }

  // 防御火力值
  get defenseFirepower() { return this._getFirepower('defensePower'); }

  // 疲劳系数
  get fatigueFactor() {
    const f = MilitaryConfig.limit.fatigueFactor;
    return this.combatChance === -1 ? f.levelOne : this.combatChance === -2 ? f.levelTwo : 1;
  }

  // 可视范围
  get visibilityRadius() { return this._maxUnitAttr('visibilityRadius'); }

  // 兵力值恢复速率
  get recoveryRate() { return this._sumUnitAttr('recoveryRate') * this.fatigueFactor; }

  // 指挥能力
  get commandCapability() { return this._maxUnitAttr('commandCapability'); }

  // 指挥范围
  get commandRange() { return this._maxUnitAttr('commandRange'); }

  /* ======================== 动态属性操作方法 =========================== */
  /**
   * 战斗结束：扣除兵力
   */
  consumeTroopStrength(cost) {
    this.troopStrength = Math.max(0, this.troopStrength - cost);
    return this.troopStrength;
  }

  /**
   * 回合结算：恢复兵力
   */
  recoverTroopStrength() {
    return this.troopStrength = Math.min(MilitaryConfig.limit.maxTroopStrength, this.troopStrength + this.recoveryRate);
  }

  /**
   * 战斗结束：消耗战斗机会次数
   */
  consumeCombatChance() {
    return this.combatChance = Math.max(MilitaryConfig.limit.combatChance.min, this.combatChance - 1);
  }

  /**
   * 回合结束：刷新战斗机会次数
   */
  refreshCombatChance(gain = MilitaryConfig.limit.combatChance.gain) {
    return this.combatChance = Math.min(MilitaryConfig.limit.combatChance.max, this.combatChance + gain);
  }

  /**
   * 移动结束：消耗行动力
   */
  consumeActionPoints(cost) {
    return this.actionPoints = Math.max(0, this.actionPoints - cost); 
  }

  /**
   * 回合结束：重置行动力
   */
  resetActionPoints() { 
    return this.actionPoints = MilitaryConfig.limit.maxActionPoints; 
  }

  /**
   * 移动：计算部队走过指定六角格需要消耗的行动力
   */
  getActionPointCost(hexId) {
    const terrain = this._terrainAt(hexId);
    let cost = 0;
    this._forEachUnit((u) => { cost = Math.max(cost, u.getActionPointCost(terrain)); });
    return cost;
  }

  /**
   * 移动：计算部队走过指定路径需要消耗的行动力
   */
  computeActionPointsForPath(hexIdPath = []) {
    let total = 0;
    hexIdPath.forEach(hexId => {
      const cost = this.getActionPointCost(hexId);
      total += cost;
    });
    return total;
  }

  /* ======================== 内部工具方法 =========================== */
  /**
   *  遍历 this.composition => 生成 { unitRef: Unit, unitCount: number } 列表
   */
  _forEachUnit(cb) {
    this.composition.forEach(({ unitId, unitCount }) => {
      const unitRef = Unit.getById(unitId);
      if (unitRef) cb(unitRef, unitCount);
    });
  }

  /**
   * 查找当前部队所在六角格的地形
   */
  _terrainAt(hexId = this.hexId) {
    const store = openGameStore();
    const cell = store.getHexCellById(hexId);
    return cell?.terrainAttributes?.terrainType ?? 'plain';
  }

  // 求所有兵种某字段的最大值
  _maxUnitAttr(attrName) {
    let max = 0;
    this._forEachUnit((unitRef) => {
      max = Math.max(max, unitRef[attrName] ?? 0);
    });
    return max;
  }

  // 求所有兵种某字段的和
  _sumUnitAttr(attrName) {
    let sum = 0;
    this._forEachUnit((unitRef, unitCount) => {
      sum += (unitRef[attrName] ?? 0) * unitCount;
    });
    return sum;
  }

  // 计算部队的火力值
  _getFirepower(powerType) {
    const terrain = this._terrainAt();
    const total = { land: 0, sea: 0, air: 0 };
    this._forEachUnit((unit, count) => {
      const power = powerType === 'attackPower'
        ? unit.getAttackPower(terrain)
        : unit.getDefensePower(terrain);
      total.land += power.land * count;
      total.sea  += power.sea  * count;
      total.air  += power.air  * count;
    });
    const k = this.morale / 100;
    return {
      land: total.land * k,
      sea:  total.sea  * k,
      air:  total.air  * k
    };
  }

  /* ======================== 序列化 =========================== */
  toPlainObject() {
    return {
      forceId: this.forceId,
      forceName: this.forceName,
      faction: this.faction,
      service: this.service,
      hexId: this.hexId,
      composition: this.composition,
      troopStrength: this.troopStrength,
      combatChance: this.combatChance,
      actionPoints: this.actionPoints,
    };
  }

  static fromPlainObject(obj) {
    return new Force(obj);
  }
}

/* ===================================================================
 * Ⅲ. Battlegroup (战斗群)
 * -------------------------------------------------------------------*/
export class Battlegroup {
  static #autoId = 1;

  constructor({ BattlegroupId, faction, commandForceId, forceIdList }) {
    this.BattlegroupId  = BattlegroupId ?? `BG_${Battlegroup.#autoId++}`;
    this.faction        = faction;
    this.commandForceId = commandForceId;
    this.forceIdList    = forceIdList; // ForceId[]，包含了commandForceId
    // this.jointAttackFirepower = get from Force.attackFirepower, commandCapability;
    // this.jointDefenseFirepower = get from Force.defenseFirepower, commandCapability;
    // this.commandCapability = get from Force.commandCapability;
    // this.commandRange = get from Force.commandRange;
  }

  /* ======================== 动态计算属性 =========================== */
  get jointAttackFirepower()  { return this._getJointFirepower('attackFirepower'); }
  get jointDefenseFirepower() { return this._getJointFirepower('defenseFirepower'); }
  get commandCapability() { return openGameStore().getForceById(this.commandForceId)?.commandCapability ?? 1; }
  get commandRange() { return openGameStore().getForceById(this.commandForceId)?.commandRange ?? 1; }

  /* ======================== 内部工具方法 =========================== */
  // 返回 forceIdList 内所有部队的对象
  _forces() { 
    return this.forceIdList
    .map(fid => openGameStore().getForceById(fid))
    .filter(Boolean); 
  }

  // 计算战斗群的联合火力值
  _getJointFirepower(firepowerType) {
    const jointFirepower = { land: 0, sea: 0, air: 0 };
    this._forces().forEach(force => {
      const firepower = force[firepowerType];
      jointFirepower.land += firepower.land; 
      jointFirepower.sea += firepower.sea; 
      jointFirepower.air += firepower.air;
    });
    const k = this.commandCapability;
    return { 
      land: jointFirepower.land * k, 
      sea: jointFirepower.sea * k, 
      air: jointFirepower.air * k 
    };
  }

  /* ======================== 序列化 =========================== */
  toPlainObject() {
    return {
      BattlegroupId: this.BattlegroupId,
      faction: this.faction,
      commandForceId: this.commandForceId,
      forceIdList: this.forceIdList,
    };
  }

  static fromPlainObject(obj) { 
    return new Battlegroup(obj); 
  }
}

/* ===================================================================
 * Ⅳ. Formation (编队)
 * -------------------------------------------------------------------*/
export class Formation {
  static #autoId = 1;

  constructor({ formationId, formationName, faction, forceIdList }) {
    this.formationId   = formationId ?? `FM_${Formation.#autoId++}`;
    this.formationName = formationName;
    this.faction       = faction;
    this.forceIdList    = forceIdList; // ForceId[]
  }

  /* ======================== 序列化 =========================== */
  toPlainObject() {
    return {
      formationId: this.formationId,
      formationName: this.formationName,
      faction: this.faction,
      forceIdList: this.forceIdList,
    };
  }

  static fromPlainObject(obj) { 
    return new Formation(obj); 
  }
}
