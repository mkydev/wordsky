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
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem; /* Boşluk eklendi */
}

.grid-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: none;
  padding: 12px 8px;
  background: transparent;
  border-radius: 8px;
}

.grid-container {
  display: inline-grid; /* Satır içi grid */
  grid-auto-flow: row;
  gap: 3px;
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
  width: clamp(20px, 5vw, 32px);
  height: clamp(20px, 5vw, 32px);
  font-size: clamp(10px, 2.5vw, 16px);
}

.grid-cell.empty {
  background-color: transparent;
  border: none;
}

.empty-box {
  width: 100%;
  height: 100%;
  background-color: #ecf0f1;
  outline: 1px solid rgba(0,0,0,0.08);
  border-radius: 4px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
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
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  outline: 1px solid rgba(0,0,0,0.08);
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #ecf0f1;
  font-size: 1.2rem;
}
</style>
