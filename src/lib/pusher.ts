import Pusher from 'pusher';

const appId = import.meta.env.PUSHER_APP_ID;
const key = import.meta.env.PUBLIC_PUSHER_KEY;
const secret = import.meta.env.PUSHER_SECRET;
const cluster = import.meta.env.PUBLIC_PUSHER_CLUSTER;

const configured = appId && key && secret && cluster;

const _pusher = configured
  ? new Pusher({ appId, key, secret, cluster, useTLS: true })
  : null;

export const pusher = {
  trigger: async (channel: string, event: string, data: unknown) => {
    if (!_pusher) return;
    await _pusher.trigger(channel, event, data);
  },
};

export const sessionChannel = (code: string) => `session-${code}`;

export const EVENTS = {
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_UPDATED: 'participant-updated',
  PARTICIPANT_LOCKED: 'participant-locked',
  STATUS_CHANGED: 'status-changed',
} as const;
