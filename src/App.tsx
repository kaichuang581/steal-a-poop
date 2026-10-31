import { GAME_TITLE } from './config'

export default function App() {
  return (
    <main className="splash">
      <h1>{GAME_TITLE}</h1>
      <p>The word-chain game where you bank the pile before someone steals it.</p>
      <p className="soon">Game coming soon.</p>
    </main>
  )
}
