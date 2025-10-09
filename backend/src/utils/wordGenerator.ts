import { turkishWords } from '../data/turkishWords';
import { GameLevel } from '../types/game.types';

export class WordGenerator {
  static canFormWord(word: string, availableLetters: string[]): boolean {
    const letterCount = new Map<string, number>();
    
    availableLetters.forEach(letter => {
      letterCount.set(letter, (letterCount.get(letter) || 0) + 1);
    });
    
    for (const letter of word) {
      const count = letterCount.get(letter) || 0;
      if (count === 0) return false;
      letterCount.set(letter, count - 1);
    }
    
    return true;
  }

  static generateLevel(difficulty: 4 | 5 | 6, targetWordCount: number = 4): GameLevel {
    const wordList = turkishWords[difficulty] || turkishWords[4];
    const maxAttempts = 100;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      const baseWord = wordList[Math.floor(Math.random() * wordList.length)];
      const letters = new Set<string>(baseWord.split(''));
      
      const extraLetterCount = Math.floor(Math.random() * 3) + 2;
      const allLetters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');
      
      for (let i = 0; i < extraLetterCount; i++) {
        const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)];
        letters.add(randomLetter);
      }
      
      const letterArray = Array.from(letters);
      const possibleWords = wordList.filter(word => 
        this.canFormWord(word, letterArray)
      );
      
      if (possibleWords.length >= targetWordCount) {
        return {
          level: Date.now(),
          difficulty,
          letters: letterArray.sort(),
          words: possibleWords.slice(0, targetWordCount),
          maxWords: possibleWords.length
        };
      }
    }
    
    const fallbackWord = wordList[0];
    const fallbackLetters = Array.from(new Set(fallbackWord.split('')));
    
    return {
      level: Date.now(),
      difficulty,
      letters: fallbackLetters.sort(),
      words: [fallbackWord],
      maxWords: 1
    };
  }

  static validateWord(word: string, letters: string[], difficulty: 4 | 5 | 6): boolean {
    const wordList = turkishWords[difficulty] || turkishWords[4];
    
    if (!wordList.includes(word.toUpperCase())) {
      return false;
    }
    
    return this.canFormWord(word.toUpperCase(), letters);
  }

  static findBonusWords(letters: string[], mainWords: string[], difficulty: 4 | 5 | 6): string[] {
    const wordList = turkishWords[difficulty] || turkishWords[4];
    const mainWordSet = new Set(mainWords);
    
    return wordList.filter(word => 
      !mainWordSet.has(word) && this.canFormWord(word, letters)
    );
  }
}