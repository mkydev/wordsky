import { computed, type ComputedRef } from 'vue';

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  horizontal: boolean;
}

export function useCrossword(words: ComputedRef<string[]>) {
  const crosswordData = computed(() => {
    try {
      if (!words.value || words.value.length === 0) {
        return { grid: [], placedWords: [] };
      }

      const sortedWords = [...words.value]
        .filter((w): w is string => typeof w === 'string' && w.length > 0)
        .map(w => w.toUpperCase())
        .sort((a, b) => b.length - a.length);

      const firstWord = sortedWords[0];

      if (!firstWord) {
        return { grid: [], placedWords: [] };
      }

      const gridSize = 40;
      const newGrid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
      const pWords: PlacedWord[] = [];

      const firstWordRow = Math.floor(gridSize / 2);
      const firstWordCol = Math.floor((gridSize - firstWord.length) / 2);
      placeWord(firstWord, firstWordRow, firstWordCol, true, newGrid);
      pWords.push({ word: firstWord, row: firstWordRow, col: firstWordCol, horizontal: true });

      for (let i = 1; i < sortedWords.length; i++) {
        const wordToPlace = sortedWords[i];

        if (!wordToPlace) continue;

        let bestFit = { score: -1, row: 0, col: 0, horizontal: false, placed: false };

        for (const pWord of pWords) {
          for (let j = 0; j < pWord.word.length; j++) {
            for (let k = 0; k < wordToPlace.length; k++) {
              if (pWord.word[j] === wordToPlace[k]) {
                const horizontal = !pWord.horizontal;
                let row, col;
                if (pWord.horizontal) { // Mevcut kelime yatay, yenisi dikey olacak
                    row = pWord.row - k;
                    col = pWord.col + j;
                } else { // Mevcut kelime dikey, yenisi yatay olacak
                    row = pWord.row + j;
                    col = pWord.col - k;
                }

                if (canPlaceWord(wordToPlace, row, col, horizontal, newGrid, gridSize, pWords)) {
                  bestFit = { score: 1, row, col, horizontal, placed: true };
                  break;
                }
              }
            }
            if (bestFit.placed) break;
          }
          if (bestFit.placed) break;
        }

        if (bestFit.placed) {
          placeWord(wordToPlace, bestFit.row, bestFit.col, bestFit.horizontal, newGrid);
          pWords.push({ word: wordToPlace, row: bestFit.row, col: bestFit.col, horizontal: bestFit.horizontal });
        } else {
           let placedFallback = false;
           for(let r = 0; r < gridSize && !placedFallback; r++){
               for(let c = 0; c < gridSize - wordToPlace.length + 1 && !placedFallback; c++){
                   if(canPlaceWord(wordToPlace, r, c, true, newGrid, gridSize, pWords)) {
                       placeWord(wordToPlace, r, c, true, newGrid);
                       pWords.push({ word: wordToPlace, row: r, col: c, horizontal: true });
                       placedFallback = true;
                   }
               }
           }
        }
      }

      let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
      pWords.forEach(pWord => {
        minRow = Math.min(minRow, pWord.row);
        maxRow = Math.max(maxRow, pWord.horizontal ? pWord.row : pWord.row + pWord.word.length - 1);
        minCol = Math.min(minCol, pWord.col);
        maxCol = Math.max(maxCol, !pWord.horizontal ? pWord.col : pWord.col + pWord.word.length - 1);
      });

      if (minRow > maxRow || minCol > maxCol) {
        return { grid: [], placedWords: [] };
      }

      const margin = 1;
      minRow = Math.max(0, minRow - margin);
      maxRow = Math.min(gridSize - 1, maxRow + margin);
      minCol = Math.max(0, minCol - margin);
      maxCol = Math.min(gridSize - 1, maxCol + margin);

      const trimmedGrid = newGrid.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1));
      const trimmedPlacedWords = pWords.map(pWord => ({
        ...pWord,
        row: pWord.row - minRow,
        col: pWord.col - minCol,
      }));

      return { grid: trimmedGrid, placedWords: trimmedPlacedWords };
    } catch (error) {
      console.error("Bulmaca oluşturulurken hata:", error);
      return { grid: [], placedWords: [] };
    }
  });

  return {
    grid: computed(() => crosswordData.value.grid),
    placedWords: computed(() => crosswordData.value.placedWords)
  };
}

function canPlaceWord(word: string, row: number, col: number, horizontal: boolean, grid: (string | null)[][], gridSize: number, placedWords: PlacedWord[]): boolean {
  if (row < 0 || col < 0 || (horizontal && col + word.length > gridSize) || (!horizontal && row + word.length > gridSize)) {
    return false;
  }

  for (let i = 0; i < word.length; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;

    const isIntersection = placedWords.some(p => {
      if (p.horizontal === horizontal) return false;
      if (p.horizontal) {
        return p.row === r && c >= p.col && c < p.col + p.word.length;
      } else {
        return p.col === c && r >= p.row && r < p.row + p.word.length;
      }
    });

    const cell = grid[r]?.[c];
    if (cell != null && cell !== word[i]) {
      return false;
    }

    if (!isIntersection) {
      if (horizontal) {
        if ((grid[r - 1]?.[c] ?? null) !== null || (grid[r + 1]?.[c] ?? null) !== null) return false;
      } else {
        if ((grid[r]?.[c - 1] ?? null) !== null || (grid[r]?.[c + 1] ?? null) !== null) return false;
      }
    }
  }

  if (horizontal) {
    if ((grid[row]?.[col - 1] ?? null) !== null || (grid[row]?.[col + word.length] ?? null) !== null) {
      return false;
    }
  } else {
    if ((grid[row - 1]?.[col] ?? null) !== null || (grid[row + word.length]?.[col] ?? null) !== null) {
      return false;
    }
  }

  return true;
}

function placeWord(word: string, row: number, col: number, horizontal: boolean, grid: (string | null)[][]) {
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (!ch) continue;

    if (horizontal) {
      const gridRow = grid[row];
      if (gridRow) gridRow[col + i] = ch ?? null;
    } else {
      const gridRow = grid[row + i];
      if (gridRow) gridRow[col] = ch ?? null;
    }
  }
}
