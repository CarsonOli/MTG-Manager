import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { apiRequest } from './api'
import {
  getCommanderCardByExactName,
  getCommanderColorIdentityCode,
  getCommanderColorIdentityLookup,
  searchCommanderCards,
  type CommanderCard,
} from './scryfall'
import type {
  AuthResponse,
  Deck,
  DeckStats,
  DeckUpsertRequest,
  LookupItem,
  PublicDeckStats,
} from './types'

type AuthMode = 'login' | 'register'
type AppView = 'home' | 'login' | 'decks' | 'deck-form' | 'stats'
type ProtectedView = 'decks' | 'deck-form' | 'stats'

type FormState = {
  deckName: string
  commander: string
  bracket: number
  colorIdentityId: number
  archetypeId: number | null
  wins: number
  losses: number
  description: string
}

const initialFormState: FormState = {
  deckName: '',
  commander: '',
  bracket: 1,
  colorIdentityId: 0,
  archetypeId: null,
  wins: 0,
  losses: 0,
  description: '',
}

function isProtectedView(view: AppView): view is ProtectedView {
  return view === 'decks' || view === 'deck-form' || view === 'stats'
}

// Calculates a readable win-rate label from the deck's persisted record.
function getDeckWinRate(deck: Deck) {
  const totalGames = deck.wins + deck.losses

  if (totalGames === 0) {
    return '0%'
  }

  return `${Math.round((deck.wins / totalGames) * 100)}%`
}

// Keeps color identity readable so colored styling is never the only signal.
function getColorIdentityLabel(deck: Deck) {
  if (!deck.colorIdentityCode) {
    return deck.colorIdentityName || 'Colorless'
  }

  return `${deck.colorIdentityName} (${deck.colorIdentityCode})`
}

// Formats API timestamps for compact dashboard metadata.
function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

// Gives screen readers useful context without relying on card art alone.
function getCommanderImageAlt(card: CommanderCard) {
  return `${card.name} card image`
}

// Shows the database's familiar display code when lookup data is available.
function getCommanderDisplayColorIdentityCode(card: CommanderCard, colorIdentities: LookupItem[]) {
  return getCommanderColorIdentityLookup(card, colorIdentities)?.code ?? getCommanderColorIdentityCode(card)
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mtgToken'))
  const [username, setUsername] = useState<string>(() => localStorage.getItem('mtgUsername') ?? '')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [currentView, setCurrentView] = useState<AppView>('home')
  const [postLoginView, setPostLoginView] = useState<ProtectedView | null>(null)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  const [publicStats, setPublicStats] = useState<PublicDeckStats | null>(null)
  const [publicStatsLoading, setPublicStatsLoading] = useState(true)
  const [publicStatsError, setPublicStatsError] = useState('')

  const [decks, setDecks] = useState<Deck[]>([])
  const [stats, setStats] = useState<DeckStats | null>(null)
  const [colorIdentities, setColorIdentities] = useState<LookupItem[]>([])
  const [archetypes, setArchetypes] = useState<LookupItem[]>([])

  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [commanderResults, setCommanderResults] = useState<CommanderCard[]>([])
  const [commanderSearchLoading, setCommanderSearchLoading] = useState(false)
  const [commanderSearchError, setCommanderSearchError] = useState('')
  const [selectedCommanderCard, setSelectedCommanderCard] = useState<CommanderCard | null>(null)
  const [topCommanderCards, setTopCommanderCards] = useState<Record<string, CommanderCard | null>>({})
  const [recordUpdatingDeckId, setRecordUpdatingDeckId] = useState<number | null>(null)

  const totalGames = useMemo(() => (stats ? stats.totalWins + stats.totalLosses : 0), [stats])
  const topCommanderKey = useMemo(
    () => publicStats?.topCommanders.map((item) => item.commander).join('|') ?? '',
    [publicStats],
  )

  // Loads public totals that can be shown before a visitor signs in.
  async function loadPublicStats() {
    setPublicStatsLoading(true)
    setPublicStatsError('')

    try {
      const statsResponse = await apiRequest<PublicDeckStats>('/api/stats/public', null)
      setPublicStats(statsResponse)
    } catch (error) {
      setPublicStatsError(error instanceof Error ? error.message : 'Unable to load public stats.')
    } finally {
      setPublicStatsLoading(false)
    }
  }

  // Loads all private dashboard data so protected views have current information.
  async function loadDashboardData(activeToken: string) {
    const [decksResponse, statsResponse, colorsResponse, archetypesResponse] = await Promise.all([
      apiRequest<Deck[]>('/api/decks', activeToken),
      apiRequest<DeckStats>('/api/stats/decks', activeToken),
      apiRequest<LookupItem[]>('/api/lookups/color-identities', activeToken),
      apiRequest<LookupItem[]>('/api/lookups/archetypes', activeToken),
    ])

    setDecks(decksResponse)
    setStats(statsResponse)
    setColorIdentities(colorsResponse)
    setArchetypes(archetypesResponse)

    setFormState((current) => ({
      ...current,
      colorIdentityId: current.colorIdentityId || colorsResponse[0]?.id || 0,
    }))
  }

  useEffect(() => {
    loadPublicStats()
  }, [])

  useEffect(() => {
    if (!token) {
      return
    }

    loadDashboardData(token).catch((error: Error) => {
      setActionError(error.message)
    })
  }, [token])

  useEffect(() => {
    const topCommanderNames = publicStats?.topCommanders.map((item) => item.commander) ?? []

    if (topCommanderNames.length === 0) {
      setTopCommanderCards({})
      return
    }

    const controller = new AbortController()

    // Hydrates public commander stats with card images without changing the stored deck schema.
    async function loadTopCommanderCards() {
      const entries = await Promise.all(
        topCommanderNames.map(async (commander) => {
          try {
            return [commander, await getCommanderCardByExactName(commander, controller.signal)] as const
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              return [commander, null] as const
            }

            return [commander, null] as const
          }
        }),
      )

      if (!controller.signal.aborted) {
        setTopCommanderCards(Object.fromEntries(entries))
      }
    }

    loadTopCommanderCards()

    return () => controller.abort()
  }, [publicStats, topCommanderKey])

  useEffect(() => {
    const commanderQuery = formState.commander.trim()
    const selectedName = selectedCommanderCard?.name ?? ''

    if (currentView !== 'deck-form' || commanderQuery.length < 2 || commanderQuery === selectedName) {
      setCommanderResults([])
      setCommanderSearchLoading(false)
      setCommanderSearchError('')
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setCommanderSearchLoading(true)
      setCommanderSearchError('')

      try {
        setCommanderResults(await searchCommanderCards(commanderQuery, controller.signal))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCommanderSearchError(error instanceof Error ? error.message : 'Unable to search Scryfall.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setCommanderSearchLoading(false)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [currentView, formState.commander, selectedCommanderCard])

  function goToView(view: AppView) {
    setActionError('')
    setAuthError('')

    if (view === 'home') {
      setPostLoginView(null)
    }

    if (isProtectedView(view) && !token) {
      setPostLoginView(view)
      setAuthMode('login')
      setCurrentView('login')
      return
    }

    setCurrentView(view)
  }

  function openLogin() {
    setPostLoginView(null)
    setAuthMode('login')
    goToView('login')
  }

  function openCreateDeckForm() {
    resetDeckForm()
    goToView('deck-form')
  }

  function clearCommanderPicker() {
    setCommanderResults([])
    setCommanderSearchError('')
    setCommanderSearchLoading(false)
    setSelectedCommanderCard(null)
  }

  // User edits clear the selected card so saves only use a deliberate Scryfall result.
  function handleCommanderInputChange(value: string) {
    setFormState({ ...formState, commander: value })

    if (selectedCommanderCard && selectedCommanderCard.name !== value.trim()) {
      setSelectedCommanderCard(null)
    }
  }

  function selectCommander(card: CommanderCard) {
    const matchingColorIdentity = getCommanderColorIdentityLookup(card, colorIdentities)

    setSelectedCommanderCard(card)
    setCommanderResults([])
    setCommanderSearchError('')
    setFormState({
      ...formState,
      commander: card.name,
      colorIdentityId: matchingColorIdentity?.id ?? formState.colorIdentityId,
    })
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const payload =
      authMode === 'login'
        ? {
            usernameOrEmail: String(formData.get('usernameOrEmail') ?? ''),
            password: String(formData.get('password') ?? ''),
          }
        : {
            name: String(formData.get('name') ?? ''),
            username: String(formData.get('username') ?? ''),
            email: String(formData.get('email') ?? ''),
            password: String(formData.get('password') ?? ''),
          }

    try {
      const authResponse = await apiRequest<AuthResponse>(endpoint, null, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      localStorage.setItem('mtgToken', authResponse.token)
      localStorage.setItem('mtgUsername', authResponse.username)
      setToken(authResponse.token)
      setUsername(authResponse.username)
      setCurrentView(postLoginView ?? 'decks')
      setPostLoginView(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    localStorage.removeItem('mtgToken')
    localStorage.removeItem('mtgUsername')
    setToken(null)
    setUsername('')
    setDecks([])
    setStats(null)
    setEditingDeckId(null)
    setRecordUpdatingDeckId(null)
    setFormState(initialFormState)
    clearCommanderPicker()
    setCurrentView('home')
    setPostLoginView(null)
  }

  function startEditing(deck: Deck) {
    setEditingDeckId(deck.deckId)
    setCurrentView('deck-form')
    clearCommanderPicker()
    setFormState({
      deckName: deck.deckName,
      commander: deck.commander,
      bracket: deck.bracket,
      colorIdentityId: deck.colorIdentityId,
      archetypeId: deck.archetypeId,
      wins: deck.wins,
      losses: deck.losses,
      description: deck.description ?? '',
    })
  }

  function resetDeckForm() {
    setEditingDeckId(null)
    clearCommanderPicker()
    setFormState({
      ...initialFormState,
      colorIdentityId: colorIdentities[0]?.id || 0,
    })
  }

  async function handleDeckSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      goToView('login')
      return
    }

    setActionError('')
    const trimmedCommander = formState.commander.trim()
    const originalCommander = editingDeckId
      ? decks.find((deck) => deck.deckId === editingDeckId)?.commander
      : null
    const commanderIsSelected = selectedCommanderCard?.name === trimmedCommander
    const commanderIsUnchanged = editingDeckId !== null && originalCommander === trimmedCommander

    if (!commanderIsSelected && !commanderIsUnchanged) {
      setActionError('Select a commander from the Scryfall results before saving.')
      return
    }

    const payload: DeckUpsertRequest = {
      deckName: formState.deckName.trim(),
      commander: selectedCommanderCard?.name ?? trimmedCommander,
      bracket: formState.bracket,
      colorIdentityId: formState.colorIdentityId,
      archetypeId: formState.archetypeId,
      wins: formState.wins,
      losses: formState.losses,
      description: formState.description,
    }

    try {
      if (editingDeckId) {
        await apiRequest<Deck>(`/api/decks/${editingDeckId}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest<Deck>('/api/decks', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      await Promise.all([loadDashboardData(token), loadPublicStats()])
      resetDeckForm()
      setCurrentView('decks')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save the deck.')
    }
  }

  // Updates only the visible match record while preserving the deck's saved details.
  async function updateDeckRecord(deck: Deck, nextWins: number, nextLosses: number) {
    if (!token) {
      goToView('login')
      return
    }

    const wins = Math.max(0, nextWins)
    const losses = Math.max(0, nextLosses)

    if (wins === deck.wins && losses === deck.losses) {
      return
    }

    const payload: DeckUpsertRequest = {
      deckName: deck.deckName,
      commander: deck.commander,
      bracket: deck.bracket,
      colorIdentityId: deck.colorIdentityId,
      archetypeId: deck.archetypeId,
      wins,
      losses,
      description: deck.description ?? '',
    }

    setActionError('')
    setRecordUpdatingDeckId(deck.deckId)

    try {
      await apiRequest<Deck>(`/api/decks/${deck.deckId}`, token, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      await Promise.all([loadDashboardData(token), loadPublicStats()])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the deck record.')
    } finally {
      setRecordUpdatingDeckId(null)
    }
  }

  async function deleteDeck(deckId: number) {
    if (!token || !confirm('Delete this deck?')) {
      return
    }

    setActionError('')
    try {
      await apiRequest<void>(`/api/decks/${deckId}`, token, { method: 'DELETE' })
      await Promise.all([loadDashboardData(token), loadPublicStats()])
      if (editingDeckId === deckId) {
        resetDeckForm()
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete deck.')
    }
  }

  function renderHomeView() {
    return (
      <>
        <section className="panel hero-panel" aria-labelledby="home-heading">
          <div className="panel-heading">
            <span className="eyebrow">Public Deck Index</span>
            <h2 id="home-heading">See what the table is building.</h2>
            <p>
              Browse high-level deck trends from every submitted list. Sign in when you are ready
              to manage your own decks and private performance stats.
            </p>
          </div>

          {publicStatsError && (
            <p className="error-text public-error" role="alert">
              {publicStatsError}
            </p>
          )}

          <div className="stats-grid" aria-label="Site-wide deck overview">
            <article className="stat-card accent-red">
              <span className="stat-label">Total Decks</span>
              <strong>{publicStatsLoading ? '-' : publicStats?.totalDecks ?? 0}</strong>
              <span className="stat-note">Submitted by all users</span>
            </article>
            <article className="stat-card accent-green">
              <span className="stat-label">Deck Builders</span>
              <strong>{publicStatsLoading ? '-' : publicStats?.totalUsers ?? 0}</strong>
              <span className="stat-note">Users with saved decks</span>
            </article>
            <article className="stat-card accent-purple">
              <span className="stat-label">Commanders</span>
              <strong>{publicStatsLoading ? '-' : publicStats?.totalCommanders ?? 0}</strong>
              <span className="stat-note">Unique submitted leaders</span>
            </article>
            <article className="stat-card accent-blue">
              <span className="stat-label">Games Logged</span>
              <strong>{publicStatsLoading ? '-' : publicStats?.totalGames ?? 0}</strong>
              <span className="stat-note">Wins and losses combined</span>
            </article>
          </div>
        </section>

        <section className="panel" aria-labelledby="top-commanders-heading">
          <div className="panel-heading compact">
            <span className="eyebrow">Most Submitted</span>
            <h2 id="top-commanders-heading">Top Commanders</h2>
            <p>The commanders appearing most often across submitted decks.</p>
          </div>

          {publicStatsLoading ? (
            <p className="muted-text">Loading top commanders...</p>
          ) : (publicStats?.topCommanders.length ?? 0) === 0 ? (
            <div className="empty-state">
              <strong>No commanders submitted yet.</strong>
              <p>Once users add decks, the most popular commanders will appear here.</p>
            </div>
          ) : (
            <ol className="top-commanders-list">
              {publicStats?.topCommanders.map((item, index) => {
                const commanderCard = topCommanderCards[item.commander]

                return (
                  <li key={item.commander}>
                    <span className="rank-number">{index + 1}</span>
                    {commanderCard?.thumbnailUrl ? (
                      <img
                        className="top-commander-image"
                        src={commanderCard.thumbnailUrl}
                        alt={getCommanderImageAlt(commanderCard)}
                      />
                    ) : (
                      <span className="top-commander-placeholder" aria-hidden="true">
                        {item.commander.charAt(0)}
                      </span>
                    )}
                    <span className="top-commander-name">
                      <span>{item.commander}</span>
                      {commanderCard && (
                        <small>{getCommanderDisplayColorIdentityCode(commanderCard, colorIdentities)}</small>
                      )}
                    </span>
                    <strong>{item.deckCount} submitted</strong>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </>
    )
  }

  function renderDeckListView() {
    return (
      <section className="panel" aria-labelledby="deck-list-heading">
        <div className="panel-heading compact page-heading-row">
          <div>
            <span className="eyebrow">Library</span>
            <h2 id="deck-list-heading">Your Decks</h2>
            <p>All decks saved to your account, sorted by most recently updated.</p>
          </div>
          <button className="button-primary" onClick={openCreateDeckForm}>
            Submit New Deck
          </button>
        </div>

        {decks.length === 0 ? (
          <div className="empty-state">
            <strong>No decks yet.</strong>
            <p>Submit your first Commander deck to start tracking records and trends.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="deck-table">
              <caption className="sr-only">Saved Commander decks with records and actions</caption>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Commander</th>
                  <th>Colors</th>
                  <th>Archetype</th>
                  <th>Record</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((deck) => {
                  const isUpdatingRecord = recordUpdatingDeckId === deck.deckId

                  return (
                    <tr key={deck.deckId}>
                      <td>
                        <strong className="deck-name">{deck.deckName}</strong>
                        <span className="deck-meta">Bracket {deck.bracket}</span>
                      </td>
                      <td>{deck.commander}</td>
                      <td>
                        <span className="badge badge-color">{getColorIdentityLabel(deck)}</span>
                      </td>
                      <td>{deck.archetypeName ?? 'Unassigned'}</td>
                      <td>
                        <div className="record-control">
                          <div>
                            <span className="record-text">
                              {deck.wins}-{deck.losses}
                            </span>
                            <span className="deck-meta">{getDeckWinRate(deck)} win rate</span>
                          </div>
                          <div className="record-stepper-group" aria-label={`Update ${deck.deckName} record`}>
                            <div className="record-stepper">
                              <span>W</span>
                              <button
                                type="button"
                                onClick={() => updateDeckRecord(deck, deck.wins - 1, deck.losses)}
                                disabled={isUpdatingRecord || deck.wins === 0}
                                title="Remove win"
                                aria-label={`Remove win from ${deck.deckName}`}
                              >
                                -
                              </button>
                              <strong>{deck.wins}</strong>
                              <button
                                type="button"
                                onClick={() => updateDeckRecord(deck, deck.wins + 1, deck.losses)}
                                disabled={isUpdatingRecord}
                                title="Add win"
                                aria-label={`Add win to ${deck.deckName}`}
                              >
                                +
                              </button>
                            </div>
                            <div className="record-stepper">
                              <span>L</span>
                              <button
                                type="button"
                                onClick={() => updateDeckRecord(deck, deck.wins, deck.losses - 1)}
                                disabled={isUpdatingRecord || deck.losses === 0}
                                title="Remove loss"
                                aria-label={`Remove loss from ${deck.deckName}`}
                              >
                                -
                              </button>
                              <strong>{deck.losses}</strong>
                              <button
                                type="button"
                                onClick={() => updateDeckRecord(deck, deck.wins, deck.losses + 1)}
                                disabled={isUpdatingRecord}
                                title="Add loss"
                                aria-label={`Add loss to ${deck.deckName}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatUpdatedAt(deck.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="button-text" onClick={() => startEditing(deck)}>
                            Edit
                          </button>
                          <button className="button-danger" onClick={() => deleteDeck(deck.deckId)}>
                            Delete Deck
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  function renderDeckFormView() {
    return (
      <section className="panel" aria-labelledby="deck-form-heading">
        <div className="panel-heading compact page-heading-row">
          <div>
            <span className="eyebrow">Deck File</span>
            <h2 id="deck-form-heading">{editingDeckId ? 'Edit Deck' : 'Submit New Deck'}</h2>
            <p>Use clear labels and saved lookup values to keep deck data consistent.</p>
          </div>
          <button className="button-secondary" onClick={() => goToView('decks')}>
            Back to Decks
          </button>
        </div>

        <form onSubmit={handleDeckSubmit} className="deck-form">
          <label>
            <span>Deck Name</span>
            <input
              value={formState.deckName}
              onChange={(event) => setFormState({ ...formState, deckName: event.target.value })}
              required
              maxLength={120}
            />
          </label>
          <div className="commander-picker full-width">
            <label>
              <span>Commander</span>
              <input
                value={formState.commander}
                onChange={(event) => handleCommanderInputChange(event.target.value)}
                required
                maxLength={120}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={commanderResults.length > 0}
                aria-controls="commander-results"
              />
            </label>

            {commanderSearchLoading && (
              <p className="muted-text commander-status">Searching Scryfall...</p>
            )}

            {commanderSearchError && (
              <p className="error-text commander-error" role="alert">
                {commanderSearchError}
              </p>
            )}

            {commanderResults.length > 0 && (
              <div
                id="commander-results"
                className="commander-results"
                role="listbox"
                aria-label="Commander search results"
              >
                {commanderResults.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="commander-result"
                    role="option"
                    onClick={() => selectCommander(card)}
                  >
                    <img src={card.thumbnailUrl} alt={getCommanderImageAlt(card)} />
                    <span>
                      <strong>{card.name}</strong>
                      <small>{card.typeLine}</small>
                    </span>
                    <span className="badge badge-color">
                      {getCommanderDisplayColorIdentityCode(card, colorIdentities)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedCommanderCard && (
              <article className="commander-preview" aria-label="Selected commander">
                <img
                  src={selectedCommanderCard.imageUrl}
                  alt={getCommanderImageAlt(selectedCommanderCard)}
                />
                <div>
                  <span className="eyebrow">Selected Commander</span>
                  <h3>{selectedCommanderCard.name}</h3>
                  <p className="commander-type-line">{selectedCommanderCard.typeLine}</p>
                  {selectedCommanderCard.oracleText && <p>{selectedCommanderCard.oracleText}</p>}
                  <a href={selectedCommanderCard.scryfallUrl} target="_blank" rel="noreferrer">
                    View on Scryfall
                  </a>
                </div>
              </article>
            )}
          </div>
          <label>
            <span>Bracket</span>
            <input
              type="number"
              min={1}
              max={5}
              value={formState.bracket}
              onChange={(event) => setFormState({ ...formState, bracket: Number(event.target.value) })}
              required
            />
          </label>
          <label>
            <span>Color Identity</span>
            <select
              value={formState.colorIdentityId}
              onChange={(event) =>
                setFormState({ ...formState, colorIdentityId: Number(event.target.value) })
              }
              required
            >
              {colorIdentities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code ? `${item.code} - ${item.name}` : item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Archetype</span>
            <select
              value={formState.archetypeId ?? ''}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  archetypeId: event.target.value ? Number(event.target.value) : null,
                })
              }
            >
              <option value="">Unassigned</option>
              {archetypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            <span>Description</span>
            <textarea
              value={formState.description}
              onChange={(event) => setFormState({ ...formState, description: event.target.value })}
              rows={3}
              maxLength={5000}
            />
          </label>

          <div className="form-actions full-width">
            <button type="submit" className="button-primary">
              {editingDeckId ? 'Update Deck' : 'Submit Deck'}
            </button>
            {editingDeckId && (
              <button type="button" className="button-secondary" onClick={resetDeckForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>
    )
  }

  function renderStatsView() {
    return (
      <section className="panel" aria-labelledby="stats-heading">
        <div className="panel-heading compact">
          <span className="eyebrow">Personal Intel</span>
          <h2 id="stats-heading">Your Deck Statistics</h2>
          <p>Private performance and deck-building trends for your saved Commander decks.</p>
        </div>

        <div className="stats-grid private-overview" aria-label="Personal deck overview">
          <article className="stat-card accent-red">
            <span className="stat-label">Decks</span>
            <strong>{stats?.totalDecks ?? 0}</strong>
            <span className="stat-note">Saved lists</span>
          </article>
          <article className="stat-card accent-green">
            <span className="stat-label">Wins</span>
            <strong>{stats?.totalWins ?? 0}</strong>
            <span className="stat-note">Recorded games</span>
          </article>
          <article className="stat-card accent-purple">
            <span className="stat-label">Losses</span>
            <strong>{stats?.totalLosses ?? 0}</strong>
            <span className="stat-note">Recorded games</span>
          </article>
          <article className="stat-card accent-blue">
            <span className="stat-label">Win Rate</span>
            <strong>{stats?.overallWinRate ?? 0}%</strong>
            <span className="stat-note">{totalGames} games tracked</span>
          </article>
        </div>

        <div className="stats-lists">
          <article className="stat-list-card">
            <h3>By Bracket</h3>
            <ul>
              {(stats?.bracketBreakdown ?? []).map((item) => (
                <li key={item.bracket}>
                  <span>Bracket {item.bracket}</span>
                  <strong>{item.deckCount}</strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="stat-list-card">
            <h3>By Color</h3>
            <ul>
              {(stats?.colorUsage ?? []).map((item) => (
                <li key={item.colorCode}>
                  <span>
                    {item.colorName} ({item.colorCode || 'C'})
                  </span>
                  <strong>{item.deckCount}</strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="stat-list-card">
            <h3>By Archetype</h3>
            <ul>
              {(stats?.archetypeBreakdown ?? []).map((item) => (
                <li key={item.archetypeName}>
                  <span>{item.archetypeName}</span>
                  <strong>{item.deckCount}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    )
  }

  function renderAuthView() {
    return (
      <section className="auth-panel" aria-labelledby="auth-heading">
        <img className="brand-logo" src="/site-logo-full.png" alt="My Deck Manager" />
        <span className="eyebrow">{postLoginView ? 'Login Required' : 'Private Deck Dashboard'}</span>
        <h2 id="auth-heading">{authMode === 'login' ? 'Login to continue' : 'Create your account'}</h2>
        <p>
          {postLoginView
            ? 'Please login before opening your decks, deck submission form, or personal stats.'
            : 'Sign in to manage your decks, records, and private collection trends.'}
        </p>

        <form onSubmit={handleAuthSubmit} className="form-grid">
          {authMode === 'register' && (
            <>
              <label>
                <span>Name</span>
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <label>
                <span>Username</span>
                <input name="username" required minLength={3} maxLength={60} />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" required maxLength={254} />
              </label>
            </>
          )}

          {authMode === 'login' && (
            <label>
              <span>Username or Email</span>
              <input name="usernameOrEmail" required />
            </label>
          )}

          <label>
            <span>Password</span>
            <input name="password" type="password" required minLength={8} />
          </label>

          {authError && (
            <p className="error-text" role="alert">
              {authError}
            </p>
          )}

          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? 'Working...' : authMode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <button
          className="button-text auth-toggle"
          onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        >
          {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </section>
    )
  }

  return (
    <main className="app-shell dashboard-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <img src="/site-logo-compass.png" alt="" aria-hidden="true" />
          <div>
            <span className="eyebrow">My Deck Manager</span>
            <h1>Deck Dashboard</h1>
            <p>{token ? `Welcome back, ${username}.` : 'Public stats are open to everyone.'}</p>
          </div>
        </div>

        <nav className="top-actions" aria-label="Primary">
          <button
            className={`nav-button ${currentView === 'home' ? 'is-active' : ''}`}
            aria-current={currentView === 'home' ? 'page' : undefined}
            onClick={() => goToView('home')}
          >
            Home
          </button>
          <button
            className={`nav-button ${currentView === 'decks' ? 'is-active' : ''}`}
            aria-current={currentView === 'decks' ? 'page' : undefined}
            onClick={() => goToView('decks')}
          >
            Decks
          </button>
          <button
            className={`nav-button ${currentView === 'stats' ? 'is-active' : ''}`}
            aria-current={currentView === 'stats' ? 'page' : undefined}
            onClick={() => goToView('stats')}
          >
            Stats
          </button>
          {token ? (
            <button className="button-secondary" onClick={signOut}>
              Sign Out
            </button>
          ) : (
            <button
              className={`button-secondary ${currentView === 'login' ? 'is-active' : ''}`}
              onClick={openLogin}
            >
              Login
            </button>
          )}
        </nav>
      </header>

      {actionError && (
        <p className="error-text dashboard-error" role="alert">
          {actionError}
        </p>
      )}

      {currentView === 'home' && renderHomeView()}
      {currentView === 'login' && renderAuthView()}
      {currentView === 'decks' && renderDeckListView()}
      {currentView === 'deck-form' && renderDeckFormView()}
      {currentView === 'stats' && renderStatsView()}
    </main>
  )
}

export default App
