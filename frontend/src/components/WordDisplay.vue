<template>
  <div class="word-display-container">
    <div class="grid-wrapper" v-if="grid.length > 0">
      <div class="grid-container">
        <div
          v-for="(row, rowIndex) in grid"
          :key="`row-${rowIndex}`"
          class="grid-row"
        >
          <div
            v-for="(cell, colIndex) in row"
            :key="`cell-${rowIndex}-${colIndex}`"
            class="grid-cell"
            :class="{ 
              'filled': cell !== null,
              'revealed': cell !== null && isFound(rowIndex, colIndex),
              'empty': cell === null
            }"
          >
            <span v-if="cell !== null && isFound(rowIndex, colIndex)" class="revealed-letter">{{ cell }}</span>
            <span v-else-if="cell !== null" class="empty-box"></span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading-state">
      <p>Bulmaca yükleniyor...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, onMounted, onUnmounted, ref, watch } from 'vue';
import { useCrossword } from '../composables/useCrossword';

const props = defineProps<{
  words: string[];
  foundWords: string[];
}>();

const { words: propWords } = toRefs(props);

const wordsComputed = computed(() => propWords.value);
const { grid, placedWords } = useCrossword(wordsComputed);

// Reactive window size tracking
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

const isFound = (row: number, col: number) => {
    return placedWords.value.some(pWord => {
        if (props.foundWords.includes(pWord.word)) {
            if (pWord.horizontal && pWord.row === row && col >= pWord.col && col < pWord.col + pWord.word.length) {
                return true;
            }
            if (!pWord.horizontal && pWord.col === col && row >= pWord.row && row < pWord.row + pWord.word.length) {
                return true;
            }
        }
        return false;
    });
}

const cellSize = computed(() => {
    const vw = Math.min(windowSize.value.width, windowSize.value.height);
    let baseSize = 28;
    
    if (vw <= 480) baseSize = 22;
    else if (vw <= 600) baseSize = 24;
    else if (vw <= 768) baseSize = 26;
    else baseSize = 28;
    
    return Math.max(20, Math.min(35, baseSize));
});

const gridContainerStyle = computed(() => {
    const gridCols = grid.value[0]?.length || 0;
    const gridRows = grid.value.length || 0;
    
    if (gridCols === 0 || gridRows === 0) {
        return { display: 'none' };
    }
    
    return {
        display: 'flex',
        width: 'fit-content',
        height: 'fit-content',
    };
});

// Watch for window size changes to trigger reactivity
watch(windowSize, () => {
    // Force reactivity update
}, { deep: true });

</script>

<style scoped>
.word-display-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.grid-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 90vw;
  max-height: 50vh;
  overflow: auto;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.grid-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 3px;
}

.grid-row {
  display: flex;
  gap: 3px;
}

.grid-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border-radius: 4px;
  font-weight: bold;
  font-size: clamp(14px, 3vw, 20px);
  color: #2c3e50;
  transition: all 0.3s ease;
  width: clamp(28px, 6vw, 40px);
  height: clamp(28px, 6vw, 40px);
  min-width: 28px;
  min-height: 28px;
  position: relative;
}

.grid-cell.filled {
  background-color: transparent;
}

.grid-cell.empty {
  background-color: transparent;
  border: none;
}

.grid-cell.revealed {
  background-color: transparent;
}

.empty-box {
  width: 100%;
  height: 100%;
  background-color: #ecf0f1;
  border: 2px solid #bdc3c7;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.revealed-letter {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: inherit;
  font-weight: bold;
  background-color: #42b883;
  border-radius: 4px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  border: 2px solid #42b883;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #ecf0f1;
  font-size: 1.2rem;
}

@media (max-width: 600px) {
  .word-display-container {
    padding: 0.5rem;
  }
  
  .grid-wrapper {
    padding: 1rem;
    max-height: 45vh;
  }
  
  .grid-cell {
    width: clamp(24px, 7vw, 32px);
    height: clamp(24px, 7vw, 32px);
    font-size: clamp(12px, 3.5vw, 16px);
  }
  
  .grid-container {
    gap: 2px;
  }
  
  .grid-row {
    gap: 2px;
  }
}

@media (max-width: 480px) {
  .word-display-container {
    padding: 0.25rem;
  }
  
  .grid-wrapper {
    padding: 0.75rem;
    max-height: 40vh;
  }
  
  .grid-cell {
    width: clamp(20px, 8vw, 28px);
    height: clamp(20px, 8vw, 28px);
    font-size: clamp(10px, 4vw, 14px);
  }
}
</style>
