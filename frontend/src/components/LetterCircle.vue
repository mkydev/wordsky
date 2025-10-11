<template>
  <div class="letter-circle-wrapper">
    <div class="selection-display">
      {{ currentWord || '\u00A0' }}
    </div>
    <div
      class="letter-circle-container"
      @mouseup="endSelection"
      @touchend="endSelection"
      @mouseleave="endSelection"
      @touchmove="handleTouchMove"
    >
      <div
        v-for="(letter, index) in letters"
        :key="index"
        class="letter"
        :class="{ selected: selectedIndices.includes(index) }"
        :style="getLetterStyle(index)"
        :data-letter="letter"
        :data-index="index"
        @mousedown="startSelection(letter, index)"
        @touchstart.prevent="startSelection(letter, index)"
        @mouseover="handleSelection(letter, index)"
      >
        {{ letter }}
      </div>
      <button class="shuffle-button" @click="$emit('shuffle')" title="Harfleri Karıştır">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="16 16 21 16 21 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
      </button>
      <svg class="lines-container" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#42b883;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#36a085;stop-opacity:1" />
            </linearGradient>
          </defs>
          <path :d="linePath" class="line-path" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ letters: string[], currentSelectedWord: string }>();
const emit = defineEmits<{(e: 'update:currentSelectedWord', word: string): void, (e: 'shuffle'): void }>();

const { letters } = toRefs(props);

const containerSize = computed(() => {
    const vw = Math.min(windowSize.value.width, windowSize.value.height);
    if (vw <= 480) return 240;
    if (vw <= 600) return 280;
    if (vw <= 768) return 300;
    return 340;
});

const radius = computed(() => {
    const vw = Math.min(windowSize.value.width, windowSize.value.height);
    if (vw <= 480) return 90;
    if (vw <= 600) return 105;
    if (vw <= 768) return 115;
    return 130;
});

const windowSize = ref({ width: window.innerWidth, height: window.innerHeight });

const updateWindowSize = () => {
    windowSize.value = { width: window.innerWidth, height: window.innerHeight };
};

onMounted(() => {
    window.addEventListener('resize', updateWindowSize);
    window.addEventListener('orientationchange', updateWindowSize);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateWindowSize);
    window.removeEventListener('orientationchange', updateWindowSize);
});

const getLetterCoords = (index: number) => {
    const angle = (index / letters.value.length) * 2 * Math.PI - Math.PI / 2;
    const currentRadius = radius.value;
    const x = Math.cos(angle) * currentRadius;
    const y = Math.sin(angle) * currentRadius;
    return { x, y };
}

watch(windowSize, () => {
}, { deep: true });

const getLetterStyle = (index: number) => {
  const { x, y } = getLetterCoords(index);
  return {
    transform: `translate(${x}px, ${y}px)`,
  };
};

const isSelecting = ref(false);
const selectedLetters = ref<string[]>([]);
const selectedIndices = ref<number[]>([]);
const currentWord = computed(() => selectedLetters.value.join(''));

watch(currentWord, (newVal) => {
    emit('update:currentSelectedWord', newVal);
});

const linePath = computed(() => {
    if (selectedIndices.value.length < 2) return '';

    const points = selectedIndices.value.map(index => {
        const coords = getLetterCoords(index);
        // Normalize to 0-100 range for SVG viewBox
        const x = ((coords.x + containerSize.value / 2) / containerSize.value) * 100;
        const y = ((coords.y + containerSize.value / 2) / containerSize.value) * 100;
        return { x, y };
    });

    if (points.length === 2) {
        // For just 2 points, use simple line
        const p0 = points[0];
        const p1 = points[1];
        if (!p0 || !p1) return '';
        return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
    }

    // Create smooth Catmull-Rom spline curve
    const firstPoint = points[0];
    if (!firstPoint) return '';

    let path = `M ${firstPoint.x} ${firstPoint.y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(i - 1, 0)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(i + 2, points.length - 1)];

        if (!p0 || !p1 || !p2 || !p3) continue;

        // Catmull-Rom to Bezier conversion
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return path;
});

function startSelection(letter: string, index: number) {
  isSelecting.value = true;
  selectedLetters.value = [letter];
  selectedIndices.value = [index];
}

function handleSelection(letter: string, index: number) {
  if (isSelecting.value && !selectedIndices.value.includes(index)) {
    selectedLetters.value.push(letter);
    selectedIndices.value.push(index);
  }
}

function handleTouchMove(event: TouchEvent) {
    if (!isSelecting.value) return;

    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;

    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element && element.classList.contains('letter')) {
        const letter = (element as HTMLElement).dataset.letter!;
        const index = parseInt((element as HTMLElement).dataset.index!);
        handleSelection(letter, index);
    }
}

function endSelection() {
  if (isSelecting.value) {
    isSelecting.value = false;
    emit('update:currentSelectedWord', currentWord.value);
    selectedLetters.value = [];
    selectedIndices.value = [];
  }
}

</script>

<style scoped>
.letter-circle-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.30rem;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}

.selection-display {
    font-size: clamp(1.2rem, 3.5vw, 1.6rem);
    font-weight: bold;
    height: clamp(2.2rem, 4vw, 3rem);
    text-align: center;
    color: #42b883;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(66, 184, 131, 0.12);
    border-radius: 8px;
    padding: 0.4rem 1.2rem;
    min-width: 140px;
    max-width: 280px;
    border: 2px solid rgba(66, 184, 131, 0.25);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(66, 184, 131, 0.15);
    letter-spacing: 0.5px;
}

.letter-circle-container {
  width: clamp(240px, 70vw, 360px);
  height: clamp(240px, 70vw, 360px);
  max-width: min(70vw, 70vh);
  max-height: min(70vw, 70vh);
  border-radius: 60%;
  position: relative;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle, rgba(66, 184, 131, 0.05) 0%, rgba(255, 255, 255, 0.02) 70%);
  border: 2px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.letter {
  position: absolute;
  width: clamp(50px, 9vw, 56px);
  height: clamp(50px, 9vw, 56px);
  border-radius: 50%;
  background: linear-gradient(145deg, #3d5a70, #2c3e50);
  border: 1.5px solid #ecf0f1;
  color: #ecf0f1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(1.3rem, 3.5vw, 1.8rem);
  font-weight: bold;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  touch-action: none;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
  transform-origin: center;
}

.letter:hover {
  background: linear-gradient(145deg, #455f77, #34495e);
  transform: scale(1.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  border-color: #fff;
}

.letter.selected {
  background: linear-gradient(145deg, #4cd49a, #42b883);
  border-color: #fff;
  color: white;
  transform: scale(1.15);
  box-shadow: 0 5px 16px rgba(66, 184, 131, 0.5);
  z-index: 2;
}

.shuffle-button {
    position: absolute;
    width: clamp(38px, 7.5vw, 48px);
    height: clamp(38px, 7.5vw, 48px);
    border-radius: 40%;
    background: linear-gradient(145deg, #3d5a70, #2c3e50);
    color: #ecf0f1;
    border: 2px solid rgba(236, 240, 241, 0.35);
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(6px);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
}

.shuffle-button:hover {
    background: linear-gradient(145deg, #455f77, #34495e);
    transform: scale(1.08) rotate(180deg);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    border-color: #fff;
}

.shuffle-button:active {
    transform: scale(0.95) rotate(180deg);
}

.shuffle-button svg {
    width: clamp(19px, 3.8vw, 24px);
    height: clamp(19px, 3.8vw, 24px);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.lines-container {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    pointer-events: none;
    overflow: visible;
}

.line-path {
    fill: none;
    stroke: url(#lineGradient);
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 2px 6px rgba(66, 184, 131, 0.5))
            drop-shadow(0 0 8px rgba(66, 184, 131, 0.3));
    transition: d 0.05s ease-out;
    opacity: 0.95;
}

/* Desktop için optimize edilmiş boyutlar */
@media (min-width: 769px) {
  .letter-circle-container {
    width: clamp(280px, 40vw, 380px);
    height: clamp(280px, 40vw, 380px);
  }

  .letter {
    width: clamp(48px, 6vw, 60px);
    height: clamp(48px, 6vw, 60px);
    font-size: clamp(1.4rem, 2.5vw, 2rem);
  }
}
</style>
