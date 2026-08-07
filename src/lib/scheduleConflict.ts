// =============================================================================
// Schedule conflict validation utility
// Detects overlapping time ranges on the same channel + day
// =============================================================================

import type { Schedule } from './types';
import { dayMaskToDays } from './format';

export type ConflictResult = {
  hasConflict: boolean;
  conflicts: Array<{
    scheduleId: number;
    message: string;
  }>;
};

/**
 * Check if a new/edited schedule conflicts with existing schedules
 * on the same channel. Two schedules conflict if they share at least
 * one day AND their time ranges overlap.
 *
 * Time overlap logic handles overnight schedules (onTime > offTime):
 *   - If onTime <= offTime: normal range (e.g., 08:00-17:00)
 *   - If onTime > offTime: overnight range (e.g., 22:00-06:00)
 */
export function validateScheduleConflict(
  newSchedule: Schedule,
  existingSchedules: Schedule[],
  excludeId?: number
): ConflictResult {
  const conflicts: ConflictResult['conflicts'] = [];
  const newOnMin = parseTimeToMinutes(newSchedule.onTime);
  const newOffMin = parseTimeToMinutes(newSchedule.offTime);
  const newDays = dayMaskToDays(newSchedule.dayMask);

  for (const existing of existingSchedules) {
    if (excludeId && existing.id === excludeId) continue;
    if (!existing.enabled) continue;

    // Check day overlap
    const existingDays = dayMaskToDays(existing.dayMask);
    let dayOverlap = false;
    for (let i = 0; i < 7; i++) {
      if (newDays[i] && existingDays[i]) {
        dayOverlap = true;
        break;
      }
    }
    if (!dayOverlap) continue;

    // Check time overlap
    const existOnMin = parseTimeToMinutes(existing.onTime);
    const existOffMin = parseTimeToMinutes(existing.offTime);

    if (rangesOverlap(newOnMin, newOffMin, existOnMin, existOffMin)) {
      conflicts.push({
        scheduleId: existing.id ?? 0,
        message: `Conflict with ${existing.onTime}-${existing.offTime}`,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Check if two time ranges overlap. Handles overnight ranges (on > off).
 * Uses the "split overnight" technique: if a range is overnight,
 * split it into [on, 1440) + [0, off), then check both segments.
 */
function rangesOverlap(
  onA: number, offA: number,
  onB: number, offB: number
): boolean {
  const segmentsA = splitOvernight(onA, offA);
  const segmentsB = splitOvernight(onB, offB);

  for (const [aStart, aEnd] of segmentsA) {
    for (const [bStart, bEnd] of segmentsB) {
      // Two ranges [aStart, aEnd) and [bStart, bEnd) overlap if:
      // aStart < bEnd AND bStart < aEnd
      if (aStart < bEnd && bStart < aEnd) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Split a time range into 1 or 2 segments.
 * If on < off: single segment [on, off)
 * If on > off: overnight → split into [on, 1440) + [0, off)
 * If on == off: empty range (no segments)
 */
function splitOvernight(on: number, off: number): Array<[number, number]> {
  if (on === off) return [];
  if (on < off) return [[on, off]];
  // Overnight
  return [[on, 1440], [0, off]];
}
