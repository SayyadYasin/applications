'use client';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import type { Partner } from '@/lib/types';
import { useAuth } from '@/store/auth';

export function usePartnerMe() {
  const token = useAuth((s) => s.token);
  const role = useAuth((s) => s.role);
  return useQuery({
    queryKey: ['partner-me'],
    queryFn: () => api<Partner>('/partners/me'),
    enabled: !!token && role === 'PARTNER',
  });
}

/** While the partner is online, watches GPS and pushes it to POST /partners/me/location (throttled). */
export function PartnerTracker() {
  const me = usePartnerMe();
  const online = me.data?.isOnline ?? false;
  const last = useRef(0);

  useEffect(() => {
    if (!online || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - last.current < 15_000) return;
        last.current = now;
        post('/partners/me/location', { lat: p.coords.latitude, lng: p.coords.longitude }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online]);

  return null;
}
