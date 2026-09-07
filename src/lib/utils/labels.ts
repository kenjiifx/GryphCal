const COMPONENT_LABELS: Record<string, string> = {
  LEC: "Lecture",
  LAB: "Laboratory",
  SEM: "Seminar",
  TUT: "Tutorial",
  EXAM: "Exam",
  DIS: "Discussion",
  IND: "Independent Study",
  PRA: "Practicum",
  FLD: "Field",
  WRK: "Work Term",
};

export function instructionalMethodLabel(code: string | undefined | null): string {
  if (!code) return "Meeting";
  const upper = code.trim().toUpperCase();
  return COMPONENT_LABELS[upper] ?? code.trim();
}
