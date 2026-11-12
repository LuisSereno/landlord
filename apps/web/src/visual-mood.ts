/** Preferencia local de presentación: nunca participa en simulación ni en snapshots. */
export const VISUAL_MOODS = ["day", "night"] as const;
export type VisualMood = (typeof VISUAL_MOODS)[number];

const STORAGE_KEY = "landlord.visual-mood";

export function readVisualMood(): VisualMood {
  try {
    return localStorage.getItem(STORAGE_KEY) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

export function applyVisualMood(mood: VisualMood): void {
  document.documentElement.dataset.visualMood = mood;
  try {
    localStorage.setItem(STORAGE_KEY, mood);
  } catch {
    // La preferencia es cosmética; un storage bloqueado no impide jugar.
  }
}
