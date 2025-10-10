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

      const gridSize = 30; // Izgara boyutu optimize edildi
      const newGrid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
      const pWords: PlacedWord[] = [];

      const firstWordRow = Math.floor(gridSize / 2);
      const firstWordCol = Math.floor((gridSize - firstWord.length) / 2);
      placeWord(firstWord, firstWordRow, firstWordCol, true, newGrid);
      pWords.push({ word: firstWord, row: firstWordRow, col: firstWordCol, horizontal: true });

      for (let i = 1; i < sortedWords.length; i++) {
        const wordToPlace = sortedWords[i];
        if (!wordToPlace) continue;

        let bestFit = { score: -1, row: 0, col: 0, horizontal: true, placed: false };

        // Kelimeyi kesiştirerek yerleştirmeyi dene
        for (const pWord of pWords) {
          for (let j = 0; j < pWord.word.length; j++) {
            for (let k = 0; k < wordToPlace.length; k++) {
              if (pWord.word[j] === wordToPlace[k]) {
                const horizontal = !pWord.horizontal;
                let row, col;

                if (pWord.horizontal) { // Mevcut kelime yatay, yenisi dikey
                  row = pWord.row - k;
                  col = pWord.col + j;
                } else { // Mevcut kelime dikey, yenisi yatay
                  row = pWord.row + j;
                  col = pWord.col - k;
                }

                if (canPlaceWord(wordToPlace, row, col, horizontal, newGrid, gridSize)) {
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
          // Yerleştirilemeyen kelimeyi konsola yaz (opsiyonel)
          console.warn(`'${wordToPlace}' kelimesi yerleştirilemedi.`);
        }
      }

      // 💡 Yeni: Tüm kelimelerin yerleştirilip yerleştirilmediğini kontrol et
      if (pWords.length !== sortedWords.length) {
        console.warn('Tüm kelimeler yerleştirilemedi, bu nedenle bulmaca geçersiz.');
        return { grid: [], placedWords: [] }; // Geçersizse boş ızgara döndür
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


function canPlaceWord(word: string, row: number, col: number, horizontal: boolean, grid: (string | null)[][], gridSize: number): boolean {
  if (row < 0 || col < 0 || (horizontal && col + word.length > gridSize) || (!horizontal && row + word.length > gridSize)) {
    return false;
  }

  for (let i = 0; i < word.length; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;

    const cell = grid[r]?.[c];

    // 1. Kesişim kontrolü: Hücre doluysa ve harf eşleşmiyorsa, yerleştirme.
    if (cell !== null && cell !== word[i]) {
      return false;
    }

    // 2. Bitişiklik kontrolü: Kelimelerin birbirine yapışmasını önle.
    // Sadece kesişim olmayan noktalarda bu kontrolü yap.
    if (cell !== word[i]) {
      if (horizontal) {
        // Üst ve alt komşular dolu olmamalı.
        if ((grid[r - 1]?.[c] ?? null) !== null || (grid[r + 1]?.[c] ?? null) !== null) {
          return false;
        }
      } else { // Dikey
        // Sol ve sağ komşular dolu olmamalı.
        if ((grid[r]?.[c - 1] ?? null) !== null || (grid[r]?.[c + 1] ?? null) !== null) {
          return false;
        }
      }
    }
  }

  // 3. Kelimenin başı ve sonu kontrolü: Başka kelimelerle birleşmesini önle.
  if (horizontal) {
    // Kelimenin solunda boşluk olmalı (veya ızgara kenarı).
    if ((grid[row]?.[col - 1] ?? null) !== null) {
      return false;
    }
    // Kelimenin sağında boşluk olmalı (veya ızgara kenarı).
    if ((grid[row]?.[col + word.length] ?? null) !== null) {
      return false;
    }
  } else { // Dikey
    // Kelimenin üstünde boşluk olmalı (veya ızgara kenarı).
    if ((grid[row - 1]?.[col] ?? null) !== null) {
      return false;
    }
    // Kelimenin altında boşluk olmalı (veya ızgara kenarı).
    if ((grid[row + word.length]?.[col] ?? null) !== null) {
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
      if (gridRow) gridRow[col + i] = ch;
    } else {
      const gridRow = grid[row + i];
      if (gridRow) gridRow[col] = ch;
    }
  }
}