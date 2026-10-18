import type { Access, FieldAccess } from 'payload'

export const chessRoomAccessKey = Symbol.for('figma-make.chess-room-api')

const isRoomApi = (req: { context?: Record<string, unknown> }) =>
  req.context?.chessRoomAccess === chessRoomAccessKey

export const canAccessChessRoom: Access = ({ req }) =>
  req.user?.collection === 'admins' || isRoomApi(req)

export const canAccessChessRoomField: FieldAccess = ({ req }) =>
  req.user?.collection === 'admins' || isRoomApi(req)
