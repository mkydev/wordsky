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
      <div class="lines-container">
          <div v-for="line in lines" :key="line.key" class="line" :style="line.style"></div>
      </div>
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

const lines = computed(() => {
    const lines = [];
    if (selectedIndices.value.length > 1) {
        for (let i = 0; i < selectedIndices.value.length - 1; i++) {
            const fromIndex = selectedIndices.value[i];
            const toIndex = selectedIndices.value[i + 1];

            if (fromIndex === undefined || toIndex === undefined) continue;

            const fromCoords = getLetterCoords(fromIndex);
            const toCoords = getLetterCoords(toIndex);

            const length = Math.sqrt(Math.pow(toCoords.x - fromCoords.x, 2) + Math.pow(toCoords.y - fromCoords.y, 2));
            const angle = Math.atan2(toCoords.y - fromCoords.y, toCoords.x - fromCoords.x) * 180 / Math.PI;

            const style = {
                top: `${fromCoords.y + containerSize.value / 2}px`,
                left: `${fromCoords.x + containerSize.value / 2}px`,
                width: `${length}px`,
                transform: `rotate(${angle}deg)`,
            };

            lines.push({ key: `${fromIndex}-${toIndex}`, style });
        }
    }
    return lines;
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
  gap: 0.75rem;
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
    border-radius: 10px;
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
  max-width: min(85vw, 85vh);
  max-height: min(85vw, 85vh);
  border-radius: 50%;
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
  width: clamp(40px, 9vw, 56px);
  height: clamp(40px, 9vw, 56px);
  border-radius: 50%;
  background: linear-gradient(145deg, #3d5a70, #2c3e50);
  border: 2.5px solid #ecf0f1;
  color: #ecf0f1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(1.1rem, 3.5vw, 1.8rem);
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
    border-radius: 50%;
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
}

.line {
    position: absolute;
    height: 4px;
    background: linear-gradient(90deg, #42b883, #36a085);
    transform-origin: 0 50%;
    z-index: 0;
    border-radius: 2px;
    box-shadow: 0 2px 6px rgba(66, 184, 131, 0.4);
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
