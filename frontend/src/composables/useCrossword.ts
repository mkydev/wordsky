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
      const sortedWords = [...words.value].sort((a, b) => b.length - a.length);
      const gridSize = 40;
      const newGrid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
      const pWords: PlacedWord[] = [];

      if (sortedWords.length === 0) return { grid: [], placedWords: [] };

      const firstWord = sortedWords[0];
      const firstWordRow = Math.floor(gridSize / 2);
      const firstWordCol = Math.floor((gridSize - firstWord.length) / 2);
      for (let i = 0; i < firstWord.length; i++) {
        newGrid[firstWordRow][firstWordCol + i] = firstWord[i];
      }
      pWords.push({ word: firstWord, row: firstWordRow, col: firstWordCol, horizontal: true });

      for (let i = 1; i < sortedWords.length; i++) {
        const wordToPlace = sortedWords[i];
        let placed = false;
        for (let j = 0; j < pWords.length; j++) {
          const existingWord = pWords[j];
          for (let k = 0; k < wordToPlace.length; k++) {
            const letter = wordToPlace[k];
            const intersectionIndex = existingWord.word.indexOf(letter);
            if (intersectionIndex !== -1) {
              let newRow, newCol, horizontal;
              if (existingWord.horizontal) {
                horizontal = false;
                newRow = existingWord.row - k;
                newCol = existingWord.col + intersectionIndex;
              } else {
                horizontal = true;
                newRow = existingWord.row + intersectionIndex;
                newCol = existingWord.col - k;
              }

              let canPlace = true;
              if (newRow < 0 || newCol < 0 || (horizontal && newCol + wordToPlace.length > gridSize) || (!horizontal && newRow + wordToPlace.length > gridSize)) {
                  canPlace = false;
              }
              if(canPlace) {
                for (let l = 0; l < wordToPlace.length; l++) {
                    let checkRow = horizontal ? newRow : newRow + l;
                    let checkCol = horizontal ? newCol + l : newCol;
                    if (checkRow >= gridSize || checkCol >= gridSize || (newGrid[checkRow][checkCol] !== null && newGrid[checkRow][checkCol] !== wordToPlace[l])) {
                        canPlace = false;
                        break;
                    }
                }
              }

              if (canPlace) {
                for (let l = 0; l < wordToPlace.length; l++) {
                  if (horizontal) {
                    newGrid[newRow][newCol + l] = wordToPlace[l];
                  } else {
                    newGrid[newRow + l][newCol] = wordToPlace[l];
                  }
                }
                pWords.push({ word: wordToPlace, row: newRow, col: newCol, horizontal });
                placed = true;
                break;
              }
            }
          }
          if (placed) break;
        }
         if(!placed) {
            let placedFallBack = false;
            for(let r = 0; r < gridSize && !placedFallBack; r++){
                for(let c = 0; c < gridSize - wordToPlace.length; c++){
                    let canPlace = true;
                    for(let l = 0; l < wordToPlace.length; l++){
                        if(newGrid[r][c+l] !== null){
                            canPlace = false;
                            break;
                        }
                    }
                    if(canPlace){
                        for (let l = 0; l < wordToPlace.length; l++) {
                            newGrid[r][c + l] = wordToPlace[l];
                        }
                        pWords.push({ word: wordToPlace, row: r, col: c, horizontal: true });
                        placedFallBack = true;
                        break;
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

      console.log("useCrossword: returned grid", trimmedGrid);
      console.log("useCrossword: returned placedWords", trimmedPlacedWords);

      return { grid: trimmedGrid, placedWords: trimmedPlacedWords };
    } catch (error) {
      console.error("Error in useCrossword:", error);
      return { grid: [], placedWords: [] }; // Return empty data on error
    }
  });

  return {
      grid: computed(() => crosswordData.value.grid),
      placedWords: computed(() => crosswordData.value.placedWords)
  };
}