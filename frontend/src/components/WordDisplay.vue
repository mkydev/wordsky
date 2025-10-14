<script setup lang="ts">
import type { PlacedWord } from '../composables/useCrossword';

const props = defineProps<{
  grid: (string | null)[][];
  placedWords: PlacedWord[];
  foundWords: string[];
}>();

const isFound = (row: number, col: number) => {
  return props.placedWords.some(pWord => {
    if (props.foundWords.includes(pWord.word.toUpperCase())) {
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
</script>

<template>
  <div class="word-display-container">
    <div class="grid-wrapper" v-if="grid.length > 0">
      <div
        class="grid-container"
        :style="{
          gridTemplateColumns: `repeat(${grid[0]?.length || 0}, 1fr)`,
        }"
      >
        <template v-for="(row, rowIndex) in grid">
          <template v-for="(cell, colIndex) in row" :key="`cell-${rowIndex}-${colIndex}`">
            <div
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
          </template>
        </template>
      </div>
    </div>
    <div v-else class="loading-state">
      <p>Bulmaca yükleniyor...</p>
    </div>
  </div>
</template>

<style scoped>
.word-display-container {
  width: 95%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.1rem;
}

.grid-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  padding: 0.1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 19px;
  border:2px solid rgba(255, 255, 255, 0.08);
}

.grid-container {
  display: inline-grid;
  grid-auto-flow: row;
  gap: clamp(2px, 0.5vw, 4px);
  padding: clamp(4px, 1vw, 8px);
}

.grid-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border-radius: 4px;
  font-weight: bold;
  color: #2c3e50;
  transition: all 0.3s ease;
  position: relative;
  width: clamp(24px, 5.5vw, 40px);
  height: clamp(24px, 5.5vw, 40px);
  font-size: clamp(12px, 3vw, 20px);
}

.grid-cell.empty {
  background-color: transparent;
  border: none;
}

.empty-box {
  width: 100%;
  height: 100%;
  background-color: rgba(236, 240, 241, 0.15);
  outline: 1px solid rgba(236, 240, 241, 0.3);
  border-radius: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
}

.revealed-letter {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: inherit;
  font-weight: bold;
  background: linear-gradient(135deg, #42b883 0%, #35a373 100%);
  border-radius: 4px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  outline: 1px solid rgba(66, 184, 131, 0.4);
  box-shadow: 0 2px 4px rgba(66, 184, 131, 0.2);
  animation: revealPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes revealPop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #ecf0f1;
  font-size: 1.2rem;
}

/* Desktop için optimize edilmiş boyutlar */
@media (min-width: 769px) {
  .grid-cell {
    width: clamp(32px, 3vw, 48px);
    height: clamp(32px, 3vw, 48px);
    font-size: clamp(16px, 2vw, 24px);
  }

  .grid-container {
    gap: clamp(3px, 0.6vw, 6px);
  }
}
</style>
