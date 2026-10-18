'use client'

import {
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Crown,
  Dices,
  DoorOpen,
  LoaderCircle,
  LogIn,
  RotateCcw,
  Sparkles,
  Swords,
  Users,
  Wifi,
} from 'lucide-react'
import { Chess, DEFAULT_POSITION, type Move, type Square } from 'chess.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ChessBoard from './ChessBoard'

type Mode = 'computer' | 'puzzle' | 'friends'
type Room = {
  roomCode: string
  fen: string
  status: 'waiting' | 'active' | 'finished'
  lastMove: string | null
  result: string | null
  revision: number
  role: 'white' | 'black'
}

const levels = [
  { elo: 200, name: 'Rookie', color: 'bg-sky-400', depth: 0 },
  { elo: 450, name: 'Scout', color: 'bg-cyan-400', depth: 0 },
  { elo: 800, name: 'Club Player', color: 'bg-emerald-400', depth: 1 },
  { elo: 1000, name: 'Strategist', color: 'bg-lime-400', depth: 1 },
  { elo: 1500, name: 'Expert', color: 'bg-amber-400', depth: 2 },
  { elo: 1800, name: 'Master', color: 'bg-orange-400', depth: 2 },
  { elo: 2000, name: 'Champion', color: 'bg-rose-400', depth: 2 },
  { elo: 2500, name: 'Grandmaster', color: 'bg-violet-400', depth: 3 },
]

const puzzles = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', line: ['d1d8'] },
  { fen: '5rk1/5ppp/8/8/2B5/8/5PPP/3R2K1 w - - 0 1', line: ['d1d8'] },
  { fen: '6k1/5ppp/8/8/8/2B5/5PPP/3R2K1 w - - 0 1', line: ['d1d8'] },
  { fen: 'r5k1/5ppp/8/8/2B5/8/5PPP/5RK1 w - - 0 1', line: ['c4f7'] },
  { fen: '3r2k1/5ppp/8/8/2B5/8/5PPP/3R2K1 w - - 0 1', line: ['d1d8'] },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', line: ['e1e8'] },
]

const pieceValue: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

function evaluate(chess: Chess) {
  let score = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) score += (piece.color === 'b' ? 1 : -1) * pieceValue[piece.type]
    }
  }
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 100000 : -100000
  return score
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess)
  const maximizing = chess.turn() === 'b'
  let best = maximizing ? -Infinity : Infinity
  for (const move of chess.moves({ verbose: true })) {
    chess.move(move)
    const value = minimax(chess, depth - 1, alpha, beta)
    chess.undo()
    if (maximizing) {
      best = Math.max(best, value)
      alpha = Math.max(alpha, value)
    } else {
      best = Math.min(best, value)
      beta = Math.min(beta, value)
    }
    if (beta <= alpha) break
  }
  return best
}

function computerMove(fen: string, level: (typeof levels)[number]) {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  if (!moves.length) return fen
  if (level.depth === 0) {
    const captures = moves.filter((move) => move.captured)
    const pool = level.elo >= 450 && captures.length ? captures : moves
    chess.move(pool[Math.floor(Math.random() * pool.length)])
    return chess.fen()
  }
  const scored = moves.map((move) => {
    chess.move(move)
    const score = minimax(chess, level.depth - 1, -Infinity, Infinity)
    chess.undo()
    return { move, score: score + Math.random() * (level.elo < 1500 ? 120 : 12) }
  })
  scored.sort((a, b) => b.score - a.score)
  chess.move(scored[0].move)
  return chess.fen()
}

function resultLabel(chess: Chess) {
  if (chess.isCheckmate()) return `${chess.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
  if (chess.isDraw()) return 'Game drawn'
  if (chess.inCheck()) return 'Check'
  return chess.turn() === 'w' ? "White's turn" : "Black's turn"
}

export default function ChessApp() {
  const [mode, setMode] = useState<Mode>('computer')
  const [fen, setFen] = useState(DEFAULT_POSITION)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [level, setLevel] = useState(levels[2])
  const [thinking, setThinking] = useState(false)
  const [puzzleIndex, setPuzzleIndex] = useState(() => Math.floor(Math.random() * puzzles.length))
  const [puzzleMessage, setPuzzleMessage] = useState('White to move. Find the best move.')
  const [solved, setSolved] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [roomToken, setRoomToken] = useState('')
  const [roomError, setRoomError] = useState('')
  const [roomBusy, setRoomBusy] = useState(false)
  const game = useMemo(() => new Chess(fen), [fen])

  const requestRoom = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/chess-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as {
      ok: boolean
      error?: string
      token?: string
      room?: Room
    }
    if (!response.ok || !data.ok) throw new Error(data.error || 'Something went wrong.')
    return data
  }, [])

  useEffect(() => {
    if (mode !== 'friends' || !room || !roomToken || room.status === 'finished') return
    const timer = window.setInterval(async () => {
      try {
        const data = await requestRoom({
          action: 'get',
          roomCode: room.roomCode,
          token: roomToken,
        })
        if (data.room) setRoom(data.room)
      } catch {
        // Keep the current position during a temporary connection interruption.
      }
    }, 1400)
    return () => window.clearInterval(timer)
  }, [mode, requestRoom, room, roomToken])

  function resetComputer() {
    setFen(DEFAULT_POSITION)
    setLastMove(null)
    setThinking(false)
  }

  function nextPuzzle() {
    let next = puzzleIndex
    while (next === puzzleIndex && puzzles.length > 1) next = Math.floor(Math.random() * puzzles.length)
    setPuzzleIndex(next)
    setFen(puzzles[next].fen)
    setLastMove(null)
    setPuzzleMessage('White to move. Find the best move.')
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode)
    setLastMove(null)
    if (nextMode === 'computer') resetComputer()
    if (nextMode === 'puzzle') {
      setFen(puzzles[puzzleIndex].fen)
      setPuzzleMessage('White to move. Find the best move.')
    }
  }

  async function handleMove(from: string, to: string) {
    if (mode === 'computer') {
      if (thinking || game.turn() !== 'w' || game.isGameOver()) return
      const next = new Chess(fen)
      try {
        next.move({ from, to, promotion: 'q' })
      } catch {
        return
      }
      setFen(next.fen())
      setLastMove({ from, to })
      if (!next.isGameOver()) {
        setThinking(true)
        window.setTimeout(() => {
          const afterComputer = computerMove(next.fen(), level)
          setFen(afterComputer)
          setThinking(false)
        }, 420)
      }
      return
    }

    if (mode === 'puzzle') {
      const expected = puzzles[puzzleIndex].line[0]
      if (`${from}${to}` !== expected) {
        setPuzzleMessage('Not quite. Look for a forcing move.')
        return
      }
      const next = new Chess(fen)
      next.move({ from, to, promotion: 'q' })
      setFen(next.fen())
      setLastMove({ from, to })
      setPuzzleMessage('Excellent. Puzzle solved!')
      setSolved((count) => count + 1)
      return
    }

    if (!room || !roomToken || room.status !== 'active') return
    setRoomBusy(true)
    setRoomError('')
    try {
      const data = await requestRoom({
        action: 'move',
        roomCode: room.roomCode,
        token: roomToken,
        from,
        to,
      })
      if (data.room) setRoom(data.room)
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Move failed.')
    } finally {
      setRoomBusy(false)
    }
  }

  async function createRoom() {
    setRoomBusy(true)
    setRoomError('')
    try {
      const data = await requestRoom({ action: 'create' })
      setRoom(data.room ?? null)
      setRoomToken(data.token ?? '')
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Could not create room.')
    } finally {
      setRoomBusy(false)
    }
  }

  async function joinRoom() {
    if (joinCode.length !== 5) {
      setRoomError('Enter all 5 digits.')
      return
    }
    setRoomBusy(true)
    setRoomError('')
    try {
      const data = await requestRoom({ action: 'join', roomCode: joinCode })
      setRoom(data.room ?? null)
      setRoomToken(data.token ?? '')
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Could not join room.')
    } finally {
      setRoomBusy(false)
    }
  }

  const displayFen = mode === 'friends' && room ? room.fen : fen
  const displayGame = new Chess(displayFen)
  const friendTurn = room?.role === (displayGame.turn() === 'w' ? 'white' : 'black')
  const isInteractive =
    mode === 'computer'
      ? !thinking && displayGame.turn() === 'w' && !displayGame.isGameOver()
      : mode === 'puzzle'
        ? puzzleMessage !== 'Excellent. Puzzle solved!'
        : Boolean(room?.status === 'active' && friendTurn && !roomBusy)

  return (
    <main className="min-h-screen bg-[#0c141d] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1540px] flex-col lg:flex-row">
        <aside className="border-b border-white/8 bg-[#101b27] px-5 py-5 lg:w-[268px] lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#81b64c] text-[#102016] shadow-[0_8px_24px_rgba(129,182,76,.22)]">
                <Crown className="h-6 w-6" strokeWidth={2.4} />
              </div>
              <div>
                <p className="text-xl font-black tracking-[-0.04em]">CHECKMATE</p>
                <p className="text-[10px] font-bold tracking-[0.22em] text-[#8fa0ae]">PLAY. LEARN. WIN.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#9fb0bd] lg:mt-8 lg:w-fit">
              <span className="h-2 w-2 rounded-full bg-[#81b64c]" />
              Live
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-3 gap-2 lg:mt-7 lg:grid-cols-1" aria-label="Game modes">
            {[
              { id: 'computer' as const, label: 'Play Computer', sub: '8 skill levels', icon: Bot },
              { id: 'puzzle' as const, label: 'Random Puzzle', sub: 'Endless tactics', icon: BrainCircuit },
              { id: 'friends' as const, label: 'Play Friends', sub: 'Private 5-digit room', icon: Users },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  className={`group flex min-h-[72px] items-center justify-center gap-3 rounded-xl px-3 py-3 text-left transition lg:justify-start lg:px-4 ${
                    mode === item.id
                      ? 'bg-[#81b64c] text-[#102016] shadow-[0_12px_30px_rgba(129,182,76,.16)]'
                      : 'text-[#aebbc5] hover:bg-white/5 hover:text-white'
                  }`}
                  key={item.id}
                  onClick={() => chooseMode(item.id)}
                  type="button"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-xs font-bold sm:text-sm">{item.label}</span>
                    <span className={`mt-0.5 hidden text-[11px] lg:block ${mode === item.id ? 'text-[#315128]' : 'text-[#657685]'}`}>
                      {item.sub}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-8 hidden rounded-xl border border-white/7 bg-white/[0.025] p-4 lg:block">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8fa0ae]">
              <CircleHelp className="h-4 w-4" />
              Quick tip
            </div>
            <p className="mt-2 text-xs leading-5 text-[#667887]">
              Select a piece to see every legal move. Your king is always protected.
            </p>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/7 px-5 py-4 sm:px-8 lg:px-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#81b64c]">Arena</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                {mode === 'computer' ? 'Play vs Computer' : mode === 'puzzle' ? 'Puzzle Rush' : 'Private Match'}
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-[#91a2af]">
              <Wifi className="h-3.5 w-3.5 text-[#81b64c]" />
              <span className="hidden sm:inline">Server connected</span>
            </div>
          </header>

          <div className="grid flex-1 items-start gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(480px,760px)_340px] xl:gap-9 xl:p-10">
            <div className="mx-auto w-full max-w-[760px]">
              <div className="mb-3 flex items-center justify-between rounded-xl border border-white/7 bg-white/[0.035] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#243241] text-sm font-black">
                    {mode === 'friends' && room?.role === 'black' ? 'YOU' : mode === 'computer' ? 'AI' : '∞'}
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {mode === 'computer'
                        ? `${level.name} Bot`
                        : mode === 'puzzle'
                          ? 'Random tactic'
                          : room
                            ? room.role === 'white'
                              ? 'Your friend'
                              : 'You'
                            : 'Waiting for match'}
                    </p>
                    <p className="text-[11px] text-[#70818e]">
                      {mode === 'computer' ? `${level.elo} ELO` : mode === 'puzzle' ? `Puzzle ${solved + 1}` : room?.status ?? 'Offline'}
                    </p>
                  </div>
                </div>
                {thinking && <LoaderCircle className="h-5 w-5 animate-spin text-[#81b64c]" />}
                {mode === 'friends' && room && (
                  <span className="rounded-full bg-[#81b64c]/12 px-3 py-1 text-[11px] font-bold text-[#9bca6d]">
                    {room.status}
                  </span>
                )}
              </div>

              <ChessBoard
                fen={displayFen}
                interactive={isInteractive}
                lastMove={mode === 'friends' ? null : lastMove}
                onMove={handleMove}
                orientation={mode === 'friends' && room?.role === 'black' ? 'black' : 'white'}
              />

              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/7 bg-white/[0.035] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dfe7dc] text-xs font-black text-[#17221d]">YOU</div>
                  <div>
                    <p className="text-sm font-bold">
                      {mode === 'friends' && room?.role === 'black' ? 'Your friend' : 'You'}
                    </p>
                    <p className="text-[11px] text-[#70818e]">
                      {mode === 'friends' && room ? `Playing ${room.role}` : 'White pieces'}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-[#8fa0ae]">
                  {mode === 'friends' && room?.result ? room.result : resultLabel(displayGame)}
                </p>
              </div>
            </div>

            <aside className="w-full rounded-2xl border border-white/8 bg-[#111d29] p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] sm:p-6 xl:sticky xl:top-10">
              {mode === 'computer' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">Choose your rival</p>
                      <p className="mt-1 text-xs text-[#718391]">From beginner to grandmaster</p>
                    </div>
                    <Dices className="h-5 w-5 text-[#81b64c]" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {levels.map((item) => (
                      <button
                        className={`rounded-xl border p-3 text-left transition ${
                          level.elo === item.elo
                            ? 'border-[#81b64c] bg-[#81b64c]/10'
                            : 'border-white/7 bg-white/[0.025] hover:border-white/20'
                        }`}
                        key={item.elo}
                        onClick={() => {
                          setLevel(item)
                          resetComputer()
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`h-2 w-2 rounded-full ${item.color}`} />
                          {level.elo === item.elo && <Check className="h-3.5 w-3.5 text-[#81b64c]" />}
                        </div>
                        <p className="mt-2 text-base font-black">{item.elo}</p>
                        <p className="text-[10px] font-semibold text-[#718391]">{item.name}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#81b64c] px-4 py-3.5 text-sm font-black text-[#102016] transition hover:bg-[#91c75a]"
                    onClick={resetComputer}
                    type="button"
                  >
                    <RotateCcw className="h-4 w-4" />
                    New game at {level.elo} ELO
                  </button>
                </>
              )}

              {mode === 'puzzle' && (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#81b64c]/12 text-[#9dce6e]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-xl font-bold">Endless random puzzles</p>
                  <p className="mt-2 text-sm leading-6 text-[#8193a0]">
                    No level picking, no pressure. Every position is selected at random to sharpen your tactical eye.
                  </p>
                  <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${puzzleMessage.startsWith('Excellent') ? 'border-[#81b64c]/30 bg-[#81b64c]/10 text-[#acd67f]' : 'border-white/8 bg-white/[0.025] text-[#b9c5ce]'}`}>
                    {puzzleMessage}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.035] p-4">
                      <p className="text-2xl font-black">{solved}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#718391]">Solved</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.035] p-4">
                      <p className="text-2xl font-black">∞</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#718391]">Available</p>
                    </div>
                  </div>
                  <button
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#81b64c] px-4 py-3.5 text-sm font-black text-[#102016]"
                    onClick={nextPuzzle}
                    type="button"
                  >
                    Next random puzzle
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {mode === 'friends' && !room && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#81b64c]/12 text-[#9dce6e]">
                      <Swords className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Play a friend</p>
                      <p className="text-xs text-[#718391]">One code. One private board.</p>
                    </div>
                  </div>
                  <button
                    className="mt-6 flex w-full items-center justify-between rounded-xl bg-[#81b64c] px-4 py-4 text-left text-[#102016] transition hover:bg-[#91c75a]"
                    disabled={roomBusy}
                    onClick={createRoom}
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <DoorOpen className="h-5 w-5" />
                      <span>
                        <span className="block text-sm font-black">Create a room</span>
                        <span className="text-[11px] font-semibold opacity-70">Get your 5-digit code</span>
                      </span>
                    </span>
                    {roomBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/8" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#536573]">or join</span>
                    <span className="h-px flex-1 bg-white/8" />
                  </div>
                  <label className="text-xs font-bold text-[#aebbc5]" htmlFor="room-code">Room code</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b151f] px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.45em] text-white outline-none transition placeholder:text-[#344552] focus:border-[#81b64c]"
                    id="room-code"
                    inputMode="numeric"
                    maxLength={5}
                    onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="00000"
                    value={joinCode}
                  />
                  <button
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-3.5 text-sm font-bold transition hover:bg-white/5"
                    disabled={roomBusy}
                    onClick={joinRoom}
                    type="button"
                  >
                    <LogIn className="h-4 w-4" />
                    Join room
                  </button>
                  {roomError && <p className="mt-3 text-center text-xs font-semibold text-rose-400">{roomError}</p>}
                </>
              )}

              {mode === 'friends' && room && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#81b64c]">
                    {room.status === 'waiting' ? 'Room created' : 'Private match'}
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {room.status === 'waiting' ? 'Invite your friend' : room.status === 'active' ? 'Game in progress' : 'Game complete'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#8193a0]">
                    {room.status === 'waiting'
                      ? 'Share this code. The board will start automatically when they join.'
                      : `You are playing ${room.role}. Moves sync automatically.`}
                  </p>
                  <button
                    className="mt-6 flex w-full items-center justify-between rounded-xl border border-[#81b64c]/30 bg-[#81b64c]/8 px-5 py-4"
                    onClick={() => navigator.clipboard.writeText(room.roomCode)}
                    type="button"
                  >
                    <span className="font-mono text-3xl font-black tracking-[0.25em] text-white">{room.roomCode}</span>
                    <Copy className="h-5 w-5 text-[#9dce6e]" />
                  </button>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-xs text-[#91a2af]">
                    {room.status === 'waiting' ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-[#81b64c]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[#81b64c]" />
                    )}
                    {room.status === 'waiting' ? 'Waiting for a friend to join…' : room.result || (friendTurn ? 'Your turn' : "Friend's turn")}
                  </div>
                  {roomError && <p className="mt-3 text-xs font-semibold text-rose-400">{roomError}</p>}
                  <button
                    className="mt-5 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#aebbc5] hover:bg-white/5"
                    onClick={() => {
                      setRoom(null)
                      setRoomToken('')
                      setRoomError('')
                    }}
                    type="button"
                  >
                    Leave room
                  </button>
                </>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
