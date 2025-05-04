<!-- src/components/hud/MilitaryPanel.vue -->
<template>
  <div class="w-80 bg-white/80 backdrop-blur-md border-l p-4 h-screen overflow-y-auto grid gap-4">
    <!-- (2) 编队列表 -->
    <Card>
      <CardContent>
        <h2 class="font-semibold text-lg mb-2 flex items-center gap-2">
          <lucide-icon name="layers" class="w-4 h-4" /> 编队列表
        </h2>
        <Accordion type="single" class="space-y-1">
          <AccordionItem v-for="fm in formations" :key="fm.formationId" :value="fm.formationId">
            <AccordionTrigger>
              <span @click.stop="onFormationClick(fm)" class="cursor-pointer hover:text-blue-600">
                {{ fm.formationName }} ({{ fm.forceIdList.length }})
              </span>
            </AccordionTrigger>
            <AccordionContent class="pl-4">
              <ul class="space-y-1">
                <li v-for="fid in fm.forceIdList" :key="fid" @click="onForceClick(fid)"
                  class="cursor-pointer hover:text-blue-600 flex justify-between">
                  <span>{{ forceName(fid) }}</span>
                  <Badge size="sm" variant="secondary">
                    {{ forceFaction(fid) }}
                  </Badge>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>

    <!-- (3) 六角格信息栏 -->
    <Card v-if="selectedHex">
      <CardContent>
        <h2 class="font-semibold text-lg mb-2 flex items-center gap-2">
          <lucide-icon name="map" class="w-4 h-4" /> 六角格信息
        </h2>
        <p>编号: {{ selectedHex.hexId }}</p>
        <p>地形: {{ selectedHex.terrainAttributes.terrainType }}</p>
        <p>高度: {{ selectedHex.terrainAttributes.elevation.toFixed(1) }} m</p>
        <p>可见: {{ selectedHex.visibility.visibleTo.blue ? "是" : "否" }}</p>
        <h3 class="mt-2 font-medium">部队 ({{ selectedHex.forcesCount }})</h3>
        <ul class="pl-2 list-disc">
          <li v-for="fid in selectedHex.forcesIds" :key="fid" @click="onForceClick(fid)"
            class="cursor-pointer hover:text-blue-600">
            {{ forceName(fid) }}
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- (4) 部队详细信息栏 -->
    <Card v-if="selectedForce">
      <CardContent>
        <h2 class="font-semibold text-lg mb-2 flex items-center gap-2">
          <lucide-icon name="shield" class="w-4 h-4" /> 部队信息
        </h2>
        <p>名称: {{ selectedForce.forceName }}</p>
        <p>阵营: <Badge variant="secondary">{{ selectedForce.faction }}</Badge></p>
        <p>位置: {{ selectedForce.hexId }}</p>
        <p>兵力: {{ selectedForce.troopStrength }}</p>
        <p>士气: {{ selectedForce.morale.toFixed(0) }}</p>
        <p>行动力: {{ selectedForce.actionPoints }}</p>
        <h3 class="mt-2 font-medium">兵种组成</h3>
        <ul class="pl-2 list-disc">
          <li v-for="comp in selectedForce.composition" :key="comp.unitId">
            {{ unitName(comp.unitId) }} × {{ comp.unitCount }}
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- (6) 战斗群列表 -->
    <Card v-if="battlegroups.length">
      <CardContent>
        <h2 class="font-semibold text-lg mb-2 flex items-center gap-2">
          <lucide-icon name="crosshair" class="w-4 h-4" /> 战斗群
        </h2>
        <ul class="space-y-2">
          <li v-for="bg in battlegroups" :key="bg.battlegroupId">
            <p class="font-medium">{{ bg.battlegroupId }} ({{ bg.forceIdList.length }} 支部队)</p>
            <p class="text-xs">指挥主体: {{ forceName(bg.commandForceId) }}</p>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>

<script setup>
import { computed, defineProps } from "vue";
import { openGameStore } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LucideIcon as lucideIcon } from "lucide-vue-next";

// 保留你原来的 props 写法
const props = defineProps({
  militaryPanelManager: Object,
});

const store = openGameStore();

/* ===== 计算列表（包装快照函数） ===== */
const formations = computed(() => store.getFormations());
const battlegroups = computed(() => store.getBattlegroups());

/* ===== 选中项 ===== */
const selectedHex = computed(() => {
  const id = [...store.getSelectedHexIds()][0];
  return id ? store.getHexCellById(id) : null;
});
const selectedForce = computed(() => {
  const id = [...store.getSelectedForceIds()][0];
  return id ? store.getForceById(id) : null;
});

/* ===== 名称助手 ===== */
const forceName = (id) => store.getForceById(id)?.forceName || id;
const forceFaction = (id) => store.getForceById(id)?.faction || "--";
const unitName = (uid) => store.getUnitById(uid)?.unitName || uid;

/* ===== 点击事件处理 ===== */
function onFormationClick(fm) {
  props.militaryPanelManager.focusFormation(fm);
}
function onForceClick(fid) {
  props.militaryPanelManager.selectForce(fid);
}
</script>

<style scoped>
/* 无额外样式 */
</style>
