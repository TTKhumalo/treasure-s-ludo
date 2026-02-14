
export type PlayerColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';

export interface Token {
  id: number;
  position: number; // -1 means in base, 0-51 are main path, 52-57 are home stretch
  status: 'BASE' | 'PATH' | 'HOME';
}

export interface Player {
  color: PlayerColor;
  tokens: Token[];
  isAI: boolean;
  name: string;
}

export type GameStatus = 'WAITING' | 'ROLLING' | 'MOVING' | 'FINISHED';

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number;
  status: GameStatus;
  winner: PlayerColor | null;
  logs: string[];
}
