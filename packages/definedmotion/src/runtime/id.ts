export const generateID = (numCharacters: number = 10): string =>
  Math.random().toString(numCharacters).slice(2, 11)
