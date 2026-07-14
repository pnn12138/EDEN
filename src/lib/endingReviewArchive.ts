import type { EdenWorldState } from "@/game/world/types";

export const ENDING_REVIEW_ARCHIVE_KEY = "eden:chapter1:ending-review-archive:v1";
const MAX_RECORDS = 12;

export type EndingReviewArchiveRecord = {
  id: string;
  savedAt: string;
  endingId: NonNullable<EdenWorldState["endingId"]>;
  timeSlot: number;
  state: EdenWorldState;
};

export function readEndingReviewArchive(): EndingReviewArchiveRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ENDING_REVIEW_ARCHIVE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEndingReviewRecord) : [];
  } catch {
    return [];
  }
}

export function archiveEndingReview(state: EdenWorldState): EndingReviewArchiveRecord | null {
  if (typeof window === "undefined" || !state.endingId) return null;
  const record: EndingReviewArchiveRecord = {
    id: `${state.endingId}-${state.timeSlot}-${state.turn}-${Date.now()}`,
    savedAt: new Date().toISOString(),
    endingId: state.endingId,
    timeSlot: state.timeSlot,
    // JSON round-trip removes React references and makes the record independent from later state mutation.
    state: JSON.parse(JSON.stringify(state)) as EdenWorldState,
  };
  try {
    const prior = readEndingReviewArchive();
    const next = [record, ...prior].slice(0, MAX_RECORDS);
    window.localStorage.setItem(ENDING_REVIEW_ARCHIVE_KEY, JSON.stringify(next));
    return record;
  } catch {
    return null;
  }
}

export function findEndingReview(id: string): EndingReviewArchiveRecord | null {
  return readEndingReviewArchive().find((record) => record.id === id) ?? null;
}

function isEndingReviewRecord(value: unknown): value is EndingReviewArchiveRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EndingReviewArchiveRecord>;
  return typeof record.id === "string" && typeof record.savedAt === "string" && Boolean(record.endingId) && Boolean(record.state);
}
