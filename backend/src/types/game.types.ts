export interface GameLevel {
  level: number;
  difficulty: 4 | 5 | 6;
  letters: string[];
  words: string[];
  maxWords: number;
}

export interface LevelRequest {
  difficulty: 4 | 5 | 6;
  letterCount?: number;
}

export interface ValidationRequest {
  word: string;
  letters: string[];
}