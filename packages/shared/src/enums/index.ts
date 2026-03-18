export const GameResult = {
  Win: 'win',
  Lose: 'lose',
} as const;

export type GameResult = (typeof GameResult)[keyof typeof GameResult];

export const LeaderboardScope = {
  Global: 'global',
  Department: 'department',
  Friend: 'friend',
} as const;

export type LeaderboardScope =
  (typeof LeaderboardScope)[keyof typeof LeaderboardScope];

export const CollectionCategory = {
  Landmark: 'landmark',
  Discipline: 'discipline',
} as const;

export type CollectionCategory =
  (typeof CollectionCategory)[keyof typeof CollectionCategory];
