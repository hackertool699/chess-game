import config from '@payload-config'
import { Chess, DEFAULT_POSITION } from 'chess.js'
import { getPayload } from 'payload'
import { chessRoomAccessKey } from '@/lib/chess-room-access'

export const dynamic = 'force-dynamic'

type Input = Record<string, unknown>
type Room = {
  id: string | number
  roomCode: string
  fen: string
  status: 'waiting' | 'active' | 'finished'
  hostToken: string
  guestToken?: string | null
  lastMove?: string | null
  result?: string | null
  revision: number
}

const context = { chessRoomAccess: chessRoomAccessKey }
const codePattern = /^\d{5}$/
const squarePattern = /^[a-h][1-8]$/

function error(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status })
}

function publicRoom(room: Room, token: string) {
  const role =
    token === room.hostToken ? 'white' : token === room.guestToken ? 'black' : null

  return {
    roomCode: room.roomCode,
    fen: room.fen,
    status: room.status,
    lastMove: room.lastMove ?? null,
    result: room.result ?? null,
    revision: room.revision,
    role,
  }
}

async function findRoom(payload: Awaited<ReturnType<typeof getPayload>>, roomCode: string) {
  const result = await payload.find({
    collection: 'chess-rooms',
    context,
    depth: 0,
    limit: 1,
    overrideAccess: false,
    where: { roomCode: { equals: roomCode } },
  })
  return result.docs[0] as unknown as Room | undefined
}

export async function POST(request: Request) {
  let input: Input
  try {
    input = (await request.json()) as Input
  } catch {
    return error('Please send a valid request.')
  }

  const action = typeof input.action === 'string' ? input.action : ''
  const payload = await getPayload({ config })

  if (action === 'create') {
    let roomCode = ''
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = String(Math.floor(10000 + Math.random() * 90000))
      if (!(await findRoom(payload, candidate))) {
        roomCode = candidate
        break
      }
    }
    if (!roomCode) return error('Could not create a room. Please try again.', 503)

    const hostToken = crypto.randomUUID()
    const room = (await payload.create({
      collection: 'chess-rooms',
      context,
      overrideAccess: false,
      data: {
        roomCode,
        fen: DEFAULT_POSITION,
        status: 'waiting',
        hostToken,
        revision: 0,
      },
    })) as unknown as Room

    return Response.json({ ok: true, token: hostToken, room: publicRoom(room, hostToken) })
  }

  const roomCode = typeof input.roomCode === 'string' ? input.roomCode.trim() : ''
  if (!codePattern.test(roomCode)) return error('Enter a valid 5-digit room code.')

  const room = await findRoom(payload, roomCode)
  if (!room) return error('That room does not exist.', 404)

  if (action === 'join') {
    if (room.status !== 'waiting' || room.guestToken) {
      return error('This room is no longer available.', 409)
    }
    const guestToken = crypto.randomUUID()
    const updated = (await payload.update({
      collection: 'chess-rooms',
      id: room.id,
      context,
      overrideAccess: false,
      data: {
        guestToken,
        status: 'active',
        revision: room.revision + 1,
      },
    })) as unknown as Room
    return Response.json({
      ok: true,
      token: guestToken,
      room: publicRoom(updated, guestToken),
    })
  }

  const token = typeof input.token === 'string' ? input.token : ''
  if (!token || (token !== room.hostToken && token !== room.guestToken)) {
    return error('You do not have access to this room.', 403)
  }

  if (action === 'get') {
    return Response.json({ ok: true, room: publicRoom(room, token) })
  }

  if (action !== 'move') return error('Unknown action.')
  if (room.status !== 'active') return error('This game is not active.', 409)

  const from = typeof input.from === 'string' ? input.from : ''
  const to = typeof input.to === 'string' ? input.to : ''
  if (!squarePattern.test(from) || !squarePattern.test(to)) {
    return error('Invalid chess move.')
  }

  const chess = new Chess(room.fen)
  const expectedRole = chess.turn() === 'w' ? 'white' : 'black'
  const playerRole = token === room.hostToken ? 'white' : 'black'
  if (expectedRole !== playerRole) return error("It is not your turn.", 409)

  let move
  try {
    move = chess.move({ from, to, promotion: 'q' })
  } catch {
    return error('That move is not legal.', 422)
  }

  const finished = chess.isGameOver()
  const result = chess.isCheckmate()
    ? `${playerRole === 'white' ? 'White' : 'Black'} wins by checkmate`
    : chess.isDraw()
      ? 'Draw'
      : null

  const updated = (await payload.update({
    collection: 'chess-rooms',
    id: room.id,
    context,
    overrideAccess: false,
    data: {
      fen: chess.fen(),
      lastMove: move.san,
      result,
      status: finished ? 'finished' : 'active',
      revision: room.revision + 1,
    },
  })) as unknown as Room

  return Response.json({ ok: true, room: publicRoom(updated, token) })
}
