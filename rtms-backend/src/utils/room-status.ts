import { RoomStatus } from '@prisma/client';

const roomStatusAliases: Record<string, RoomStatus> = {
  occupied: RoomStatus.DANG_THUE,
  dang_thue: RoomStatus.DANG_THUE,
  '\u0111ang thu\u00ea': RoomStatus.DANG_THUE,
  available: RoomStatus.TRONG,
  trong: RoomStatus.TRONG,
  'tr\u1ed1ng': RoomStatus.TRONG,
  reserved: RoomStatus.DA_COC,
  da_coc: RoomStatus.DA_COC,
  '\u0111\u00e3 c\u1ecdc': RoomStatus.DA_COC,
  maintenance: RoomStatus.SUA_CHUA,
  sua_chua: RoomStatus.SUA_CHUA,
  's\u1eeda ch\u1eefa': RoomStatus.SUA_CHUA
};

const roomStatusLabels: Record<RoomStatus, string> = {
  [RoomStatus.DANG_THUE]: '\u0110ang thu\u00ea',
  [RoomStatus.TRONG]: 'Tr\u1ed1ng',
  [RoomStatus.DA_COC]: '\u0110\u00e3 c\u1ecdc',
  [RoomStatus.SUA_CHUA]: 'S\u1eeda ch\u1eefa'
};

const roomStatusApiValues: Record<RoomStatus, string> = {
  [RoomStatus.DANG_THUE]: 'OCCUPIED',
  [RoomStatus.TRONG]: 'AVAILABLE',
  [RoomStatus.DA_COC]: 'RESERVED',
  [RoomStatus.SUA_CHUA]: 'MAINTENANCE'
};

export const toRoomStatus = (value: unknown): RoomStatus | null => {
  if (typeof value !== 'string') return null;
  return roomStatusAliases[value.normalize('NFC').toLowerCase()] ?? null;
};

export const toRoomStatusLabel = (value: RoomStatus): string => roomStatusLabels[value];
export const toRoomStatusApiValue = (value: RoomStatus): string => roomStatusApiValues[value];
