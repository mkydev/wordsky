import { Router, Request, Response } from 'express';
import { WordGenerator } from '../utils/wordGenerator';
import { LevelRequest, ValidationRequest } from '../types/game.types';

const router = Router();

router.post('/level/generate', (req: Request, res: Response) => {
  try {
    const { difficulty = 4, letterCount = 4 }: LevelRequest = req.body;
    
    if (![4, 5, 6].includes(difficulty)) {
      return res.status(400).json({ 
        error: 'Invalid difficulty. Must be 4, 5, or 6' 
      });
    }
    
    const level = WordGenerator.generateLevel(difficulty, letterCount);
    
    res.json({
      success: true,
      level: {
        id: level.level,
        difficulty: level.difficulty,
        letters: level.letters,
        words: level.words,
        totalPossibleWords: level.maxWords
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate level',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/word/validate', (req: Request, res: Response) => {
  try {
    const { word, letters }: ValidationRequest = req.body;
    
    if (!word || !letters || !Array.isArray(letters)) {
      return res.status(400).json({ 
        error: 'Invalid request. Need word and letters array' 
      });
    }
    
    const isValid = WordGenerator.validateWord(word, letters, 4);
    
    res.json({
      success: true,
      valid: isValid,
      word: word.toUpperCase()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to validate word',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/words/bonus', (req: Request, res: Response) => {
  try {
    const { letters, mainWords, difficulty = 4 } = req.body;
    
    if (!letters || !mainWords || !Array.isArray(letters) || !Array.isArray(mainWords)) {
      return res.status(400).json({ 
        error: 'Invalid request. Need letters and mainWords arrays' 
      });
    }
    
    const bonusWords = WordGenerator.findBonusWords(letters, mainWords, difficulty);
    
    res.json({
      success: true,
      bonusWords,
      count: bonusWords.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to find bonus words',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Word Game API'
  });
});

export default router;