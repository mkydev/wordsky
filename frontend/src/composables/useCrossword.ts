import { computed, type ComputedRef } from 'vue';

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  horizontal: boolean;
}

// --- Helper Fonksiyonlar ---

/**
 * Mevcut ızgaranın derin bir kopyasını oluşturur.
 * Bu, backtracking sırasında denemelerin ana ızgarayı bozmamasını sağlar.
 */
function copyGrid(grid: (string | null)[][]): (string | null)[][] {
  return grid.map(row => [...row]);
}

/**
 * Kelimede yanyana iki sesli harf olup olmadığını kontrol eder.
 * Türkçe sesli harfler: A, E, I, İ, O, Ö, U, Ü
 */
function hasConsecutiveVowels(word: string): boolean {
  const vowels = new Set(['A', 'E', 'I', 'İ', 'O', 'Ö', 'U', 'Ü']);
  for (let i = 0; i < word.length - 1; i++) {
    // DÜZELTME: .charAt() metodu, 'undefined' tip hatasını önler.
    if (vowels.has(word.charAt(i)) && vowels.has(word.charAt(i + 1))) {
      return true;
    }
  }
  return false;
}

/**
 * Bir kelimenin belirtilen konuma yerleştirilip yerleştirilemeyeceğini kontrol eder.
 * Kesişim, bitişiklik ve sınırlar gibi kuralları uygular.
 */
function canPlaceWord(word: string, row: number, col: number, horizontal: boolean, grid: (string | null)[][], gridSize: number): boolean {
  // 1. Izgara sınırları içinde mi?
  if (row < 0 || col < 0 || (horizontal && col + word.length > gridSize) || (!horizontal && row + word.length > gridSize)) {
    return false;
  }

  for (let i = 0; i < word.length; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;

    const cell = grid[r]?.[c];

    // 2. Kesişim kontrolü: Hücre doluysa ve harf uyuşmuyorsa, yerleştirilemez.
    if (cell !== null && cell !== word[i]) {
      return false;
    }

    // 3. Bitişiklik kontrolü: Kelimeler birbirine yapışmamalı (sadece kesişim noktası hariç).
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

  // 4. Kelimenin başı ve sonu kontrolü: Başka kelimelerle istenmeyen birleşmeleri önle.
  if (horizontal) {
    if ((grid[row]?.[col - 1] ?? null) !== null || (grid[row]?.[col + word.length] ?? null) !== null) {
      return false;
    }
  } else { // Dikey
    if ((grid[row - 1]?.[col] ?? null) !== null || (grid[row + word.length]?.[col] ?? null) !== null) {
      return false;
    }
  }

  return true;
}

/**
 * Kelimeyi ızgaraya yerleştirir.
 */
function placeWord(word: string, row: number, col: number, horizontal: boolean, grid: (string | null)[][]) {
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]!;
    if (horizontal) {
      grid[row]![col + i] = ch;
    } else {
      grid[row + i]![col] = ch;
    }
  }
}

// --- Backtracking Algoritması ---

/**
 * Geriye dönük iz sürme (backtracking) kullanarak kelimeleri yerleştirmeyi deneyen ana fonksiyon.
 * @param wordsToPlace Yerleştirilecek kelimelerin listesi.
 * @param grid Mevcut ızgara durumu.
 * @param placedWords Zaten yerleştirilmiş kelimelerin listesi.
 * @param gridSize Izgara boyutu.
 * @returns Başarılı olursa yerleştirilmiş kelimelerin listesini, olmazsa null döndürür.
 */
function solvePuzzle(wordsToPlace: string[], grid: (string | null)[][], placedWords: PlacedWord[], gridSize: number): PlacedWord[] | null {
  // Temel durum: Yerleştirilecek kelime kalmadıysa, bulmaca çözülmüştür.
  if (wordsToPlace.length === 0) {
    return placedWords;
  }

  const wordToPlace = wordsToPlace[0]!;
  const remainingWords = wordsToPlace.slice(1);

  // Olası yerleşimleri denemek için karıştır (daha çeşitli bulmacalar için)
  const shuffledPlacedWords = [...placedWords].sort(() => Math.random() - 0.5);

  for (const pWord of shuffledPlacedWords) {
    for (let i = 0; i < pWord.word.length; i++) {
      for (let j = 0; j < wordToPlace.length; j++) {
        // Kesişim bulundu
        if (pWord.word[i] === wordToPlace[j]) {
          const horizontal = !pWord.horizontal;
          let row: number, col: number;

          if (pWord.horizontal) { // Mevcut kelime yatay, yenisi dikey
            row = pWord.row - j;
            col = pWord.col + i;
          } else { // Mevcut kelime dikey, yenisi yatay
            row = pWord.row + i;
            col = pWord.col - j;
          }

          if (canPlaceWord(wordToPlace, row, col, horizontal, grid, gridSize)) {
            const newGrid = copyGrid(grid);
            placeWord(wordToPlace, row, col, horizontal, newGrid);
            const newPlacedWords = [...placedWords, { word: wordToPlace, row, col, horizontal }];

            // Özyinelemeli çağrı
            const result = solvePuzzle(remainingWords, newGrid, newPlacedWords, gridSize);
            if (result) {
              return result; // Çözüm bulundu, yukarı döndür
            }
            // Bu yol çözüme götürmedi, döngüye devam et (backtracking)
          }
        }
      }
    }
  }

  return null; // Hiçbir yerleşim çözüme götürmedi
}


// --- Ana Composable Fonksiyon ---

export function useCrossword(words: ComputedRef<string[]>) {
  const crosswordData = computed(() => {
    try {
      const validWords = words.value
        .filter((w): w is string => typeof w === 'string' && w.length > 0)
        .map(w => w.toUpperCase())
        .filter(w => !hasConsecutiveVowels(w)); // Yanyana sesli harf içermeyenleri filtrele

      if (validWords.length === 0) {
        return { grid: [], placedWords: [] };
      }

      // Kelimeleri uzunluğa göre azalan sırada sırala
      const sortedWords = [...validWords].sort((a, b) => b.length - a.length);
      const firstWord = sortedWords[0]!;
      const remainingWords = sortedWords.slice(1);

      const gridSize = 40; // Olası tüm yerleşimler için yeterli alan bırak
      const initialGrid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

      // İlk kelimeyi ızgaranın ortasına yerleştir
      const firstWordRow = Math.floor(gridSize / 2);
      const firstWordCol = Math.floor((gridSize - firstWord.length) / 2);
      placeWord(firstWord, firstWordRow, firstWordCol, true, initialGrid);

      const initialPlacedWords: PlacedWord[] = [
        { word: firstWord, row: firstWordRow, col: firstWordCol, horizontal: true }
      ];

      // Backtracking algoritmasını başlat
      const finalPlacedWords = solvePuzzle(remainingWords, initialGrid, initialPlacedWords, gridSize);

      if (!finalPlacedWords || finalPlacedWords.length !== sortedWords.length) {
        console.warn('Tüm kelimelerle geçerli bir bulmaca oluşturulamadı. Lütfen kelime setini kontrol edin.');
        return { grid: [], placedWords: [] };
      }

      // --- Ízgarayı Kırpma ---
      const finalGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
      finalPlacedWords.forEach(p => placeWord(p.word, p.row, p.col, p.horizontal, finalGrid));

      let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
      finalPlacedWords.forEach(pWord => {
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

      const trimmedGrid = finalGrid.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1));
      const trimmedPlacedWords = finalPlacedWords.map(pWord => ({
        ...pWord,
        row: pWord.row - minRow,
        col: pWord.col - minCol,
      })).sort((a, b) => a.word.localeCompare(b.word)); // Kelimeleri alfabetik sırala

      return { grid: trimmedGrid, placedWords: trimmedPlacedWords };

    } catch (error) {
      console.error("Bulmaca oluşturulurken kritik bir hata oluştu:", error);
      return { grid: [], placedWords: [] };
    }
  });

  return {
    grid: computed(() => crosswordData.value.grid),
    placedWords: computed(() => crosswordData.value.placedWords)
  };
}
