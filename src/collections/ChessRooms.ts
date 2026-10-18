import type { CollectionConfig } from 'payload'
import {
  canAccessChessRoom,
  canAccessChessRoomField,
} from '@/lib/chess-room-access'

export const ChessRooms: CollectionConfig = {
  slug: 'chess-rooms',
  access: {
    create: canAccessChessRoom,
    delete: canAccessChessRoom,
    read: canAccessChessRoom,
    update: canAccessChessRoom,
  },
  admin: {
    group: 'Game operations',
    useAsTitle: 'roomCode',
    defaultColumns: ['roomCode', 'status', 'revision', 'updatedAt'],
  },
  fields: [
    {
      name: 'roomCode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: null | string | undefined) =>
        /^\d{5}$/.test(value ?? '') || 'Room code must contain exactly 5 digits.',
    },
    {
      name: 'fen',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'waiting',
      options: [
        { label: 'Waiting', value: 'waiting' },
        { label: 'Active', value: 'active' },
        { label: 'Finished', value: 'finished' },
      ],
    },
    {
      name: 'hostToken',
      type: 'text',
      required: true,
      hidden: true,
      access: {
        create: canAccessChessRoomField,
        read: canAccessChessRoomField,
        update: canAccessChessRoomField,
      },
    },
    {
      name: 'guestToken',
      type: 'text',
      hidden: true,
      access: {
        create: canAccessChessRoomField,
        read: canAccessChessRoomField,
        update: canAccessChessRoomField,
      },
    },
    {
      name: 'lastMove',
      type: 'text',
    },
    {
      name: 'result',
      type: 'text',
    },
    {
      name: 'revision',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
  ],
}
