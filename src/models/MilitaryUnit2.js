// src/models/MilitaryUnit.js
// ============================================================
// 兵种系统核心数据模型
// ------------------------------------------------------------
// 说明：
//   • Unit    —— 兵种模板（同一个兵种实例可被多个 Force 引用）
//   • Force   —— 部队（地图上渲染实体）
//   • BattleGroup —— 战斗群（临时联合体）
//   • Formation    —— 编队（管理分组）
//
//   * 部队‑六角格、部队‑编队 等关联全部由 HexForceMapper 维护。
//   * Pinia store 暴露 getHex / getForce，实体通过 id → PlainObject Map 检索。
// ============================================================

import { HexForceMapper }   from '@/utils/HexForceMapper';
import { openGameStore }    from '@/store';
import { MilitaryConfig }   from '@/config/GameConfig';

const store = openGameStore();

/* ===================================================================
 * Ⅰ. Unit  (兵种)
 * -------------------------------------------------------------------*/
export class Unit {
  static #autoId = 1; // 自动递增 id
  static #registry = new Map(); // 兵种注册表

  /**
   * 兵种模版：创建并缓存兵种
   * 
   * 传入的opt对象的id为null时，表示创建一个新兵种并返回其引用；
   * 传入的opt对象的id不为null时：
   *  - 一般表示正在创建部队，需要这个兵种作为组成，要从兵种注册表中
   *    返回一个该兵种的引用（多个部队共用同一个兵种模板对象）作为该部队的成员。
   *  - 或者表示要按指定id去创建一个部队，此时已经匹配过了注册表
   *    确保没有id重复的，所以也不会创造出id相同的部队了
   * 
   * @param obj 兵种的PlainObject形式
   */
  static create(obj) {
    // 一方面是防止创建同一个id的兵种，发生冲突；另一方面是
    if (Unit.#registry.has(obj.unitId)) {
      return Unit.#registry.get(obj.unitId);
    }
    const newUnit = new Unit(obj);
    Unit.#registry.set(newUnit.unitId, newUnit);
    return newUnit;
  }
  static getById(id) { return Unit.#registry.get(id); }

  constructor({
    // ===== Identification =====
    unitId, unitName, service, category, unitAvailability,
    // ===== Combat Attributes =====
    attackPowerComposition, defensePowerComposition,
    // ===== Survival Attributes =====
    visibilityRadius, actionPointCostComposition, recoveryRate,
    // ===== Command Attributes =====
    commandCapability = 1, commandRange = 1,
  }) {
    this.unitId = unitId ?? `U_${Unit.#autoId++}`;
    this.unitName = unitName;
    this.service = service;
    this.category = category;
    this.unitAvailability = unitAvailability;
    this.attackPowerComposition = attackPowerComposition;
    this.defensePowerComposition = defensePowerComposition;
    this.visibilityRadius = visibilityRadius;
    this.actionPointCostComposition = actionPointCostComposition;
    this.recoveryRate = recoveryRate;
    this.commandCapability = commandCapability;
    this.commandRange = commandRange;
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
      unitAvailability: this.unitAvailability,
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
    this.faction   = faction;
    this.service   = service;
    this.hexId = hexId; // updated from HexForceMapper

    // 兵种组成：[{ unitId, unitCount }]
    this.composition = composition;

    this.troopStrength = troopStrength; // 0‑100
    // this.morale = get from troopStrength, commandCapability;
    // this.attackFirepower  = get from Unit.attackPower , unitCount, morale;
    // this.defenseFirepower = get from Unit.defensePower, unitCount, morale;
    this.combatChance = combatChance; // 初始 0，回合结束 +2，上限 1，下限 -2
    // this.fatigueFactor = get from combatChance;

    // this.visibilityRadius = get from Unit.visibilityRadius;
    this.actionPoints = actionPoints; // 0-100. updated from Unit.actionPointCost, HexCell;
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
  get recoveryRate() { return this._weightedSumUnitAttr('recoveryRate') * this.fatigueFactor; }

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
  refreshCombatChance(gain = 2) {
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
    const cell = store.getHex(hexId);
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
 * Ⅲ. BattleGroup (战斗群)
 * -------------------------------------------------------------------*/
export class BattleGroup {
  static #autoId = 1;

  constructor({ battlegroupId, faction, commandForceId, forceIdList }) {
    this.battlegroupId  = battlegroupId ?? `BG_${BattleGroup.#autoId++}`;
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
  get commandCapability() { return store.getForce(this.commandForceId)?.commandCapability ?? 1; }
  get commandRange() { return store.getForce(this.commandForceId)?.commandRange ?? 1; }

  /* ======================== 内部工具方法 =========================== */
  // 返回 forceIdList 内所有部队的对象
  _forces() { 
    return this.forceIdList
    .map(fid => store.getForce(fid))
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
      battlegroupId: this.battlegroupId,
      faction: this.faction,
      commandForceId: this.commandForceId,
      forceIdList: this.forceIdList,
    };
  }

  static fromPlainObject(obj) { 
    return new BattleGroup(obj); 
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
