import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { apiRequest } from './api'
import type { AuthResponse, Deck, DeckStats, DeckUpsertRequest, LookupItem } from './types'

type AuthMode = 'login' | 'register'
type AppView = 'home' | 'decks' | 'stats'

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

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mtgToken'))
  const [username, setUsername] = useState<string>(() => localStorage.getItem('mtgUsername') ?? '')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [currentView, setCurrentView] = useState<AppView>('home')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  const [decks, setDecks] = useState<Deck[]>([])
  const [stats, setStats] = useState<DeckStats | null>(null)
  const [colorIdentities, setColorIdentities] = useState<LookupItem[]>([])
  const [archetypes, setArchetypes] = useState<LookupItem[]>([])

  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const totalGames = useMemo(() => (stats ? stats.totalWins + stats.totalLosses : 0), [stats])

  // Loads all dashboard data so each view has current information.
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
    if (!token) {
      return
    }

    loadDashboardData(token).catch((error: Error) => {
      setActionError(error.message)
    })
  }, [token])

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
      setCurrentView('home')
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
    setFormState(initialFormState)
    setCurrentView('home')
  }

  function startEditing(deck: Deck) {
    setEditingDeckId(deck.deckId)
    setCurrentView('decks')
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
    setFormState({
      ...initialFormState,
      colorIdentityId: colorIdentities[0]?.id || 0,
    })
  }

  async function handleDeckSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      return
    }

    setActionError('')

    const payload: DeckUpsertRequest = {
      deckName: formState.deckName.trim(),
      commander: formState.commander.trim(),
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

      await loadDashboardData(token)
      resetDeckForm()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save the deck.')
    }
  }

  async function deleteDeck(deckId: number) {
    if (!token || !confirm('Delete this deck?')) {
      return
    }

    setActionError('')
    try {
      await apiRequest<void>(`/api/decks/${deckId}`, token, { method: 'DELETE' })
      await loadDashboardData(token)
      if (editingDeckId === deckId) {
        resetDeckForm()
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete deck.')
    }
  }

  function renderHomeView() {
    return (
      <section className="card">
        <h2>Home</h2>
        <p>Track your Commander collection, keep win/loss records, and review trends over time.</p>
        <div className="stats-grid">
          <article className="card"><h3>Decks</h3><p>{stats?.totalDecks ?? 0}</p></article>
          <article className="card"><h3>Wins</h3><p>{stats?.totalWins ?? 0}</p></article>
          <article className="card"><h3>Losses</h3><p>{stats?.totalLosses ?? 0}</p></article>
          <article className="card"><h3>Win Rate</h3><p>{stats?.overallWinRate ?? 0}%</p><small>{totalGames} games tracked</small></article>
        </div>
      </section>
    )
  }

  function renderDecksView() {
    return (
      <>
        <section className="card">
          <h2>{editingDeckId ? 'Edit Deck' : 'Add Deck'}</h2>
          <form onSubmit={handleDeckSubmit} className="deck-form">
            <label>Deck Name<input value={formState.deckName} onChange={(event) => setFormState({ ...formState, deckName: event.target.value })} required maxLength={120} /></label>
            <label>Commander<input value={formState.commander} onChange={(event) => setFormState({ ...formState, commander: event.target.value })} required maxLength={120} /></label>
            <label>Bracket<input type="number" min={1} max={5} value={formState.bracket} onChange={(event) => setFormState({ ...formState, bracket: Number(event.target.value) })} required /></label>
            <label>Color Identity
              <select value={formState.colorIdentityId} onChange={(event) => setFormState({ ...formState, colorIdentityId: Number(event.target.value) })} required>
                {colorIdentities.map((item) => (
                  <option key={item.id} value={item.id}>{item.code ? `${item.code} - ${item.name}` : item.name}</option>
                ))}
              </select>
            </label>
            <label>Archetype
              <select value={formState.archetypeId ?? ''} onChange={(event) => setFormState({ ...formState, archetypeId: event.target.value ? Number(event.target.value) : null })}>
                <option value="">Unassigned</option>
                {archetypes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>Wins<input type="number" min={0} value={formState.wins} onChange={(event) => setFormState({ ...formState, wins: Number(event.target.value) })} required /></label>
            <label>Losses<input type="number" min={0} value={formState.losses} onChange={(event) => setFormState({ ...formState, losses: Number(event.target.value) })} required /></label>
            <label className="full-width">Description
              <textarea value={formState.description} onChange={(event) => setFormState({ ...formState, description: event.target.value })} rows={3} maxLength={5000} />
            </label>

            <div className="form-actions full-width">
              <button type="submit">{editingDeckId ? 'Update Deck' : 'Create Deck'}</button>
              {editingDeckId && <button type="button" className="secondary" onClick={resetDeckForm}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Your Decks</h2>
          {decks.length === 0 ? (
            <p>No decks yet. Add your first Commander deck above.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Commander</th>
                  <th>Colors</th>
                  <th>Archetype</th>
                  <th>Record</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((deck) => (
                  <tr key={deck.deckId}>
                    <td>{deck.deckName}</td>
                    <td>{deck.commander}</td>
                    <td>{deck.colorIdentityCode}</td>
                    <td>{deck.archetypeName ?? 'Unassigned'}</td>
                    <td>{deck.wins}-{deck.losses}</td>
                    <td>
                      <button className="text-button" onClick={() => startEditing(deck)}>Edit</button>
                      <button className="text-button danger" onClick={() => deleteDeck(deck.deckId)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </>
    )
  }

  function renderStatsView() {
    return (
      <section className="card stats-lists">
        <div>
          <h2>By Bracket</h2>
          <ul>{(stats?.bracketBreakdown ?? []).map((item) => <li key={item.bracket}>Bracket {item.bracket}: {item.deckCount}</li>)}</ul>
        </div>
        <div>
          <h2>By Color</h2>
          <ul>{(stats?.colorUsage ?? []).map((item) => <li key={item.colorCode}>{item.colorCode} ({item.colorName}): {item.deckCount}</li>)}</ul>
        </div>
        <div>
          <h2>By Archetype</h2>
          <ul>{(stats?.archetypeBreakdown ?? []).map((item) => <li key={item.archetypeName}>{item.archetypeName}: {item.deckCount}</li>)}</ul>
        </div>
      </section>
    )
  }

  if (!token) {
    return (
      <main className="container">
        <section className="card auth-card">
          <h1>Commander Deck Manager</h1>
          <p>Track your decks, win/loss records, and collection trends in one place.</p>

          <form onSubmit={handleAuthSubmit} className="form-grid">
            {authMode === 'register' && (
              <>
                <label>
                  Name
                  <input name="name" required minLength={2} maxLength={120} />
                </label>
                <label>
                  Username
                  <input name="username" required minLength={3} maxLength={60} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required maxLength={254} />
                </label>
              </>
            )}

            {authMode === 'login' && (
              <label>
                Username or Email
                <input name="usernameOrEmail" required />
              </label>
            )}

            <label>
              Password
              <input name="password" type="password" required minLength={8} />
            </label>

            {authError && <p className="error-text">{authError}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Working...' : authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <button className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="container">
      <header className="top-bar">
        <div>
          <h1>Commander Deck Manager</h1>
          <p>Welcome back, {username}.</p>
        </div>
        <div className="top-actions">
          <button className={currentView === 'home' ? 'secondary' : ''} onClick={() => setCurrentView('home')}>Home</button>
          <button className={currentView === 'decks' ? 'secondary' : ''} onClick={() => setCurrentView('decks')}>Decks</button>
          <button className={currentView === 'stats' ? 'secondary' : ''} onClick={() => setCurrentView('stats')}>Stats</button>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </header>

      {actionError && <p className="error-text">{actionError}</p>}

      {currentView === 'home' && renderHomeView()}
      {currentView === 'decks' && renderDecksView()}
      {currentView === 'stats' && renderStatsView()}
    </main>
  )
}

export default App
