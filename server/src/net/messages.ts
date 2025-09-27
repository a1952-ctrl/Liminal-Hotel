export interface MicMessage {
  type: 'mic';
  level: number;
  flags?: {
    pushToTalk?: boolean;
    enabled?: boolean;
  };
}

export type ClientMessage = MicMessage;

export function isMicMessage(payload: unknown): payload is MicMessage {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const candidate = payload as Partial<MicMessage>;
  if (candidate.type !== 'mic') {
    return false;
  }
  const level = (candidate as { level?: unknown }).level;
  return typeof level === 'number' && Number.isFinite(level);
}
