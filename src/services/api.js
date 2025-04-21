// src\services\api.js
import { openGameStore } from "@/store";

// 模拟后端 API 模块
export const API = {
  move: async (forceId, path) => {
    // 模拟网络延迟
    await new Promise(r => setTimeout(r, 300));
    console.log(`[MockApi] move ${forceId} along`, path);
    const store = openGameStore();
    // 将 force 最终 hexId 更新为路径末尾
    const f = store.getForceById(forceId);
    if (f && path.length) {
      f.hexId = path[path.length - 1];
    }
    return { success: true, path };
  },
  attack: async (commandForceId, targetHex, supportForceIds) => {
    await new Promise(r => setTimeout(r, 500));
    console.log(`[MockApi] attack by ${commandForceId} at ${targetHex}, support:`, supportForceIds);
    // 简易胜负随机
    const win = Math.random() > 0.5;
    return { success: true, result: win ? 'win' : 'lose' };
  },
  createForce: async (hexId, faction, composition) => {
    await new Promise(r => setTimeout(r, 400));
    console.log(`[MockApi] createForce at ${hexId} for ${faction}:`, composition);
    const store = openGameStore();
    // 生成新 force
    const data = { hexId, faction, service: composition[0].service, composition };
    const newForce = store.addForce(data);
    return { success: true, force: newForce.toPlainObject() };
  },
  mergeForces: async (hexId, forceIds) => {
    await new Promise(r => setTimeout(r, 400));
    console.log(`[MockApi] mergeForces at ${hexId}:`, forceIds);
    const store = openGameStore();
    // 简单：第一个为主，后续合并 composition
    const main = store.getForceById(forceIds[0]);
    const others = forceIds.slice(1).map(id => store.getForceById(id));
    others.forEach(f => {
      f.composition.forEach(u => main.composition.push(u));
      store.forceMap.delete(f.forceId);
    });
    return { success: true, merged: main.toPlainObject() };
  },
  splitForce: async (forceId, splitDetails) => {
    await new Promise(r => setTimeout(r, 400));
    console.log(`[MockApi] splitForce ${forceId}:`, splitDetails);
    const store = openGameStore();
    const original = store.getForceById(forceId);
    if (!original) return { success: false };
    // 删除原部队
    store.forceMap.delete(forceId);
    // 创建多支新部队
    const newForces = splitDetails.map(detail => {
      const data = {
        hexId: original.hexId,
        faction: original.faction,
        service: original.service,
        composition: detail.composition || original.composition,
        forceName: detail.newForceName
      };
      return store.addForce(data).toPlainObject();
    });
    return { success: true, forces: newForces };
  }
};