const scryfallBaseUrl = 'https://api.scryfall.com'
const colorOrder = ['W', 'U', 'B', 'R', 'G']

type ScryfallImageUris = {
  small?: string
  normal?: string
  art_crop?: string
}

type ScryfallCardFace = {
  oracle_text?: string
  image_uris?: ScryfallImageUris
}

type ScryfallCard = {
  id: string
  name: string
  type_line: string
  oracle_text?: string
  color_identity: string[]
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  scryfall_uri: string
}

type ScryfallListResponse = {
  data?: ScryfallCard[]
}

export type CommanderCard = {
  id: string
  name: string
  typeLine: string
  oracleText: string
  colorIdentity: string[]
  imageUrl: string
  thumbnailUrl: string
  scryfallUrl: string
}

// Keeps user text safely inside a quoted Scryfall search value.
function quoteScryfallValue(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

// Scryfall returns two-faced card images on card_faces, so image lookup needs a fallback chain.
function getCardImageUris(card: ScryfallCard) {
  return card.image_uris ?? card.card_faces?.find((face) => face.image_uris)?.image_uris
}

// Converts Scryfall's card shape into the smaller commander shape the UI needs.
function mapCommanderCard(card: ScryfallCard): CommanderCard | null {
  const images = getCardImageUris(card)
  const oracleText =
    card.oracle_text ?? card.card_faces?.map((face) => face.oracle_text).filter(Boolean).join('\n\n') ?? ''

  if (!images?.normal && !images?.small) {
    return null
  }

  return {
    id: card.id,
    name: card.name,
    typeLine: card.type_line,
    oracleText,
    colorIdentity: card.color_identity,
    imageUrl: images.normal ?? images.small ?? '',
    thumbnailUrl: images.small ?? images.normal ?? '',
    scryfallUrl: card.scryfall_uri,
  }
}

// Searches legal legendary creatures so newly saved deck commanders use Scryfall's exact card names.
export async function searchCommanderCards(query: string, signal?: AbortSignal) {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 2) {
    return []
  }

  const searchQuery = `name:${quoteScryfallValue(trimmedQuery)} t:legendary t:creature legal:commander`
  const params = new URLSearchParams({
    q: searchQuery,
    unique: 'cards',
    order: 'name',
  })

  const response = await fetch(`${scryfallBaseUrl}/cards/search?${params.toString()}`, { signal })

  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    throw new Error('Scryfall search is unavailable right now.')
  }

  const payload = (await response.json()) as ScryfallListResponse
  return (payload.data ?? []).map(mapCommanderCard).filter((card): card is CommanderCard => card !== null)
}

// Looks up existing saved commander names for public top-commander images.
export async function getCommanderCardByExactName(name: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ exact: name })
  const response = await fetch(`${scryfallBaseUrl}/cards/named?${params.toString()}`, { signal })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Scryfall card lookup is unavailable right now.')
  }

  return mapCommanderCard((await response.json()) as ScryfallCard)
}

// Matches Scryfall color identity ordering to the database's WUBRG/C lookup codes.
export function getCommanderColorIdentityCode(card: CommanderCard) {
  return colorOrder.filter((color) => card.colorIdentity.includes(color)).join('') || 'C'
}
