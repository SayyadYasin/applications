'use client';
import { useEffect, useRef, useState } from 'react';
import { directionsUrl, loadMaps, type GMaps } from '@/lib/external';
import { useT } from '@/i18n';

export interface Pin { lat: number; lng: number; label: string; color?: string }

/** Google Map with markers; degrades to a textual fallback when the key/script is missing. */
export function MapView({ pins, height = 260 }: { pins: Pin[]; height?: number }) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ maps: GMaps; map: unknown; markers: Map<string, unknown> } | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    loadMaps().then((maps) => {
      if (!live) return;
      if (!maps || !el.current) return setOk(false);
      const c = pins[0] ?? { lat: 20.59, lng: 78.96 };
      state.current = { maps, map: new maps.Map(el.current, { center: { lat: c.lat, lng: c.lng }, zoom: 14, disableDefaultUI: true, zoomControl: true }), markers: new Map() };
      setOk(true);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!ok || !s) return;
    const bounds = new s.maps.LatLngBounds();
    for (const p of pins) {
      const pos = { lat: p.lat, lng: p.lng };
      let m = s.markers.get(p.label) as { setPosition(p: unknown): void } | undefined;
      if (m) m.setPosition(pos);
      else {
        m = new s.maps.Marker({ position: pos, map: s.map, label: p.label.slice(0, 1).toUpperCase(), title: p.label });
        s.markers.set(p.label, m);
      }
      bounds.extend(pos);
    }
    if (pins.length > 1) (s.map as { fitBounds(b: unknown, pad?: number): void }).fitBounds(bounds, 48);
    else if (pins.length === 1) (s.map as { setCenter(p: unknown): void }).setCenter({ lat: pins[0].lat, lng: pins[0].lng });
  }, [pins, ok]);

  if (ok === false) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        <p className="mb-2">{t('bookings.mapsMissing')}</p>
        {pins.map((p) => (
          <p key={p.label}>
            <a className="text-brand underline" target="_blank" rel="noreferrer" href={directionsUrl(p.lat, p.lng)}>
              {p.label}: {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </a>
          </p>
        ))}
      </div>
    );
  }
  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-2xl bg-gray-100" role="region" aria-label="Map" />;
}
