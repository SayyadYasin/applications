'use client';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API_BASE } from './api';
import { useAuth } from '@/store/auth';
import type { ChatMessage } from './types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? new URL(API_BASE, 'http://localhost').origin;
// API_BASE may be relative-free; derive origin safely.
function origin() {
  try {
    return process.env.NEXT_PUBLIC_WS_URL ?? new URL(API_BASE).origin;
  } catch {
    return WS_URL;
  }
}

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(): Socket | null {
  const token = useAuth.getState().token;
  if (!token) return null;
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = io(`${origin()}/chat`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketToken = token;
  }
  return socket;
}

export interface BookingSocketHandlers {
  onMessage?: (m: ChatMessage) => void;
  onRead?: (e: { bookingId: string; by: string; messageIds: string[] }) => void;
  onLocation?: (e: { bookingId: string; lat: number; lng: number; at: string }) => void;
  onStatus?: (e: { bookingId: string; status: string; at: string }) => void;
}

/** Joins the booking room and wires the realtime events; leaves on unmount. */
export function useBookingSocket(bookingId: string | undefined, handlers: BookingSocketHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!bookingId) return;
    const s = getSocket();
    if (!s) return;
    const join = () => s.emit('join', { bookingId });
    const onMsg = (m: ChatMessage) => m.bookingId === bookingId && h.current.onMessage?.(m);
    const onRead = (e: { bookingId: string; by: string; messageIds: string[] }) => e.bookingId === bookingId && h.current.onRead?.(e);
    const onLoc = (e: { bookingId: string; lat: number; lng: number; at: string }) => e.bookingId === bookingId && h.current.onLocation?.(e);
    const onStatus = (e: { bookingId: string; status: string; at: string }) => e.bookingId === bookingId && h.current.onStatus?.(e);
    s.on('connect', join);
    if (s.connected) join();
    s.on('message', onMsg);
    s.on('read', onRead);
    s.on('location', onLoc);
    s.on('booking:status', onStatus);
    return () => {
      s.emit('leave', { bookingId });
      s.off('connect', join);
      s.off('message', onMsg);
      s.off('read', onRead);
      s.off('location', onLoc);
      s.off('booking:status', onStatus);
    };
  }, [bookingId]);
}

export function emitLocation(bookingId: string, lat: number, lng: number) {
  getSocket()?.emit('location', { bookingId, lat, lng });
}
export function emitRead(bookingId: string) {
  getSocket()?.emit('read', { bookingId });
}
export function emitMessage(bookingId: string, body: string): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (!s || !s.connected) return resolve({ error: 'offline' });
    s.timeout(8000).emit('message', { bookingId, body }, (err: Error | null, res: { ok?: boolean; error?: string }) =>
      resolve(err ? { error: 'timeout' } : res),
    );
  });
}
