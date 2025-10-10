<template>
  <div class="selection-display">
    {{ currentWord }}
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
    <button class="shuffle-button" @click="$emit('shuffle')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="16 16 21 16 21 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
    </button>
    <div class="lines-container">
        <div v-for="line in lines" :key="line.key" class="line" :style="line.style"></div>
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
    if (vw <= 480) return 260;
    if (vw <= 600) return 300;
    if (vw <= 768) return 340;
    return 380;
});

const radius = computed(() => {
    const vw = Math.min(windowSize.value.width, windowSize.value.height);
    if (vw <= 480) return 100;
    if (vw <= 600) return 115;
    if (vw <= 768) return 130;
    return 145;
});

// Reactive window size tracking for better mobile support
const windowSize = ref({ width: window.innerWidth, height: window.innerHeight });

const updateWindowSize = () => {
    windowSize.value = { width: window.innerWidth, height: window.innerHeight };
};

onMounted(() => {
    console.log("LetterCircle: mounted");
    console.log("LetterCircle: letters prop", props.letters);
    window.addEventListener('resize', updateWindowSize);
    window.addEventListener('orientationchange', updateWindowSize);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateWindowSize);
    window.removeEventListener('orientationchange', updateWindowSize);
});

const getLetterCoords = (index: number) => {
    const angle = (index / letters.value.length) * 2 * Math.PI - Math.PI / 2; // Start from top
    const currentRadius = radius.value;
    const x = Math.cos(angle) * currentRadius;
    const y = Math.sin(angle) * currentRadius;
    return { x, y };
}

// Update computed values to be reactive to window size changes
watch(windowSize, () => {
    // Force reactivity update
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
.selection-display {
    font-size: clamp(1.4rem, 4vw, 1.8rem); /* Boyutu biraz küçült */
    font-weight: bold;
    margin-bottom: 0.5rem; /* Boşluğu azalt */
    height: clamp(1.8rem, 4.5vw, 2.5rem); /* Yüksekliği azalt */
    text-align: center;
    color: #42b883;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(66, 184, 131, 0.1);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    min-width: 120px;
    border: 2px solid rgba(66, 184, 131, 0.2);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.letter-circle-container {
  width: clamp(260px, 80vw, 400px); /* Daha büyük */
  height: clamp(260px, 80vw, 400px);
  max-width: min(90vw, 90vh);
  max-height: min(90vw, 90vh);
  border-radius: 50%;
  position: relative;
  margin: 0.5rem auto; /* Margin azaltıldı */
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.letter {
  position: absolute;
  width: clamp(42px, 10vw, 60px); /* Daha büyük harfler */
  height: clamp(42px, 10vw, 60px);
  border-radius: 50%;
  background-color: #34495e;
  border: 3px solid #ecf0f1;
  color: #ecf0f1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(1.2rem, 4vw, 2rem); /* Daha büyük font */
  font-weight: bold;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  z-index: 1;
  touch-action: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transform-origin: center;
}

.letter:hover {
  background-color: #2c3e50;
  transform: scale(1.05);
}

.letter.selected {
  background-color: #42b883;
  border-color: #42b883;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.4);
}

.shuffle-button {
    position: absolute;
    width: clamp(40px, 8vw, 50px);
    height: clamp(40px, 8vw, 50px);
    border-radius: 50%;
    background-color: rgba(52, 73, 94, 0.8);
    color: #ecf0f1;
    border: 2px solid rgba(236, 240, 241, 0.3);
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0.8;
    z-index: 2;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
}

.shuffle-button:hover {
    opacity: 1;
    background-color: rgba(52, 73, 94, 0.9);
    transform: scale(1.05);
}

.shuffle-button svg {
    width: clamp(20px, 4vw, 26px);
    height: clamp(20px, 4vw, 26px);
}

.lines-container {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
}

.line {
    position: absolute;
    height: 4px;
    background: linear-gradient(90deg, #42b883, #36a085);
    transform-origin: 0 50%;
    z-index: 0;
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(66, 184, 131, 0.3);
}

</style>
