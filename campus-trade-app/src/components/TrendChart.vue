<template>
  <q-card flat bordered class="trend-card">
    <div class="trend-header">
      <div>
        <div class="trend-title">平台趋势统计</div>
        <div class="trend-sub">近 7 日发布与交易情况</div>
      </div>
      <div class="trend-legend">
        <span class="legend-dot items"></span>
        新增商品
        <span class="legend-dot orders"></span>
        订单量
      </div>
    </div>
    <div class="trend-grid">
      <div
        v-for="(point, idx) in series"
        :key="point.label"
        class="trend-row animate-in"
        :style="{ '--delay': `${idx * 0.05}s` }"
      >
        <div class="trend-label">{{ point.label }}</div>
        <div class="trend-bars">
          <div class="bar-track">
            <div class="bar items" :style="{ width: barWidth(point.items) }"></div>
          </div>
          <div class="bar-track">
            <div class="bar orders" :style="{ width: barWidth(point.orders) }"></div>
          </div>
        </div>
        <div class="trend-value">{{ point.items }} / {{ point.orders }}</div>
      </div>
    </div>
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  series: {
    type: Array,
    default: () => []
  }
})
const ready = ref(false)

const maxValue = computed(() => {
  if (!props.series.length) return 1
  return Math.max(1, ...props.series.map((point) => Math.max(point.items || 0, point.orders || 0)))
})

function barWidth (value) {
  if (!ready.value) return '0%'
  if (!value) return '0%'
  const percent = (value / maxValue.value) * 100
  return `${Math.max(percent, 10)}%`
}

onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})
</script>
