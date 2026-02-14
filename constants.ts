
import { PlayerColor } from './types';

export const BOARD_SIZE = 15;

// Global path coordinates (52 squares)
// Starting from Red's start (row 6, col 1) and going clockwise
export const PATH_COORDINATES: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], 
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0]
];

// Home Stretch coordinates for each color
export const HOME_STRETCH_COORDINATES: Record<PlayerColor, [number, number][]> = {
  RED: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  GREEN: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  YELLOW: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  BLUE: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
};

export const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47]; // Indices in PATH_COORDINATES

export const START_INDICES: Record<PlayerColor, number> = {
  RED: 0,
  GREEN: 13,
  YELLOW: 26,
  BLUE: 39,
};

export const COLORS: Record<PlayerColor, string> = {
  RED: '#ef4444',
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  BLUE: '#3b82f6',
};

export const COLORS_LIGHT: Record<PlayerColor, string> = {
  RED: '#fee2e2',
  GREEN: '#dcfce7',
  YELLOW: '#fef9c3',
  BLUE: '#dbeafe',
};
