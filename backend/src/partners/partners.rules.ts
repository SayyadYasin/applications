import { BadRequestException } from '@nestjs/common';

export const REQUIRED_KYC_DOCS = ['AADHAAR', 'SELFIE'] as const;

export function missingKycDocs(types: string[]): string[] {
  return REQUIRED_KYC_DOCS.filter((t) => !types.includes(t));
}

export interface Slot {
  weekday: number;
  startMin: number;
  endMin: number;
}

/** Throws when the slot is invalid or overlaps an existing slot on the same weekday (touching edges are allowed). */
export function validateSlot(slot: Slot, existing: (Slot & { id?: string })[], ignoreId?: string) {
  if (slot.startMin >= slot.endMin) throw new BadRequestException('startMin must be before endMin');
  const clash = existing.some(
    (s) => s.id !== ignoreId && s.weekday === slot.weekday && slot.startMin < s.endMin && s.startMin < slot.endMin,
  );
  if (clash) throw new BadRequestException('Slot overlaps an existing availability slot');
}

/** True when there are no slots (always available) or one covers the booking's weekday and time window. */
export function slotsCover(slots: Slot[], at: Date, durationMin = 0): boolean {
  if (!slots.length) return true;
  const weekday = at.getDay();
  const start = at.getHours() * 60 + at.getMinutes();
  return slots.some((s) => s.weekday === weekday && s.startMin <= start && start + durationMin <= s.endMin);
}
