export function generateWords(baseWord: string, wordList: string[]): string[] {
  const letters = baseWord.split('');
  const subwords = new Set<string>(); // Kelimeler "Set" veri yapısında tutuluyor

  function canBeFormed(word: string, availableLetters: string[]): boolean {
    const wordLetters = word.split('');
    const available = [...availableLetters];
    for (const letter of wordLetters) {
      const index = available.indexOf(letter);
      if (index === -1) {
        return false;
      }
      available.splice(index, 1);
    }
    return true;
  }

  for (const word of wordList) {
    if (word.length >= 3 && canBeFormed(word, letters)) {
      subwords.add(word); // ".add()" metodu sayesinde aynı kelime tekrar eklenmez
    }
  }

  return Array.from(subwords); // Set, tekrar diziye çevrilerek döndürülüyor
}