'use client'

import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { useMemo, useState } from 'react'

const pieces: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
}

type Props = {
  fen: string
  orientation?: 'white' | 'black'
  interactive?: boolean
  lastMove?: { from: string; to: string } | null
  onMove: (from: string, to: string) => void
}

export default function ChessBoard({
  fen,
  orientation = 'white',
  interactive = true,
  lastMove,
  onMove,
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null)
  const chess = useMemo(() => new Chess(fen), [fen])
  const files = orientation === 'white' ? 'abcdefgh'.split('') : 'hgfedcba'.split('')
  const ranks = orientation === 'white' ? '87654321'.split('') : '12345678'.split('')
  const legalTargets = selected
    ? chess.moves({ square: selected, verbose: true }).map((move) => move.to)
    : []

  function chooseSquare(square: Square) {
    if (!interactive) return
    if (selected && legalTargets.includes(square)) {
      onMove(selected, square)
      setSelected(null)
      return
    }
    const piece = chess.get(square)
    if (piece?.color === chess.turn()) setSelected(square)
    else setSelected(null)
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[18px] shadow-[0_24px_70px_rgba(6,14,28,.28)] ring-1 ring-white/10">
      <div className="grid h-full w-full grid-cols-8">
        {ranks.flatMap((rank, rankIndex) =>
          files.map((file, fileIndex) => {
            const square = `${file}${rank}` as Square
            const piece = chess.get(square)
            const isLight = (file.charCodeAt(0) + Number(rank)) % 2 === 1
            const isSelected = selected === square
            const isTarget = legalTargets.includes(square)
            const wasMoved = lastMove?.from === square || lastMove?.to === square
            return (
              <button
                aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
                className={[
                  'relative flex aspect-square items-center justify-center transition-colors',
                  isLight ? 'bg-[#e7ecdf]' : 'bg-[#73936b]',
                  wasMoved ? '!bg-[#c7d65a]' : '',
                  isSelected ? '!bg-[#e6d85e]' : '',
                ].join(' ')}
                key={square}
                onClick={() => chooseSquare(square)}
                type="button"
              >
                {fileIndex === 0 && (
                  <span
                    className={`absolute left-1 top-0.5 text-[9px] font-bold sm:text-[11px] ${isLight ? 'text-[#73936b]' : 'text-[#e7ecdf]'}`}
                  >
                    {rank}
                  </span>
                )}
                {rankIndex === 7 && (
                  <span
                    className={`absolute bottom-0 right-1 text-[9px] font-bold sm:text-[11px] ${isLight ? 'text-[#73936b]' : 'text-[#e7ecdf]'}`}
                  >
                    {file}
                  </span>
                )}
                {isTarget && (
                  <span
                    className={`absolute rounded-full ${piece ? 'inset-1.5 border-[5px] border-black/20 sm:inset-2 sm:border-[7px]' : 'h-[22%] w-[22%] bg-black/20'}`}
                  />
                )}
                {piece && (
                  <span
                    className={`relative z-10 select-none text-[clamp(2rem,7vw,4.5rem)] leading-none drop-shadow-[0_2px_1px_rgba(0,0,0,.32)] ${piece.color === 'w' ? 'text-white [-webkit-text-stroke:1px_#27342d]' : 'text-[#17221d]'}`}
                  >
                    {pieces[piece.color][piece.type]}
                  </span>
                )}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}
