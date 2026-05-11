export type AuthResponse = {
  token: string
  userId: number
  username: string
  userRole: string
}

export type LookupItem = {
  id: number
  name: string
  code?: string
}

export type Deck = {
  deckId: number
  userId: number
  colorIdentityId: number
  colorIdentityCode: string
  colorIdentityName: string
  archetypeId: number | null
  archetypeName: string | null
  deckName: string
  commander: string
  bracket: number
  wins: number
  losses: number
  description: string | null
  createdAt: string
  updatedAt: string
}

export type DeckUpsertRequest = {
  deckName: string
  commander: string
  bracket: number
  colorIdentityId: number
  archetypeId: number | null
  wins: number
  losses: number
  description: string
}

export type DeckStats = {
  totalDecks: number
  totalWins: number
  totalLosses: number
  overallWinRate: number
  bracketBreakdown: { bracket: number; deckCount: number }[]
  colorUsage: { colorCode: string; colorName: string; deckCount: number }[]
  archetypeBreakdown: { archetypeName: string; deckCount: number }[]
}
