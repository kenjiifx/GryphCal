import { getTermAcademicDates } from "@/lib/calendar/academicDates";
import type { Term } from "@/lib/guelph/types";

export function normalizeTerm(item: {
  Item1?: string;
  Item2?: string;
  code?: string;
  name?: string;
}): Term | null {
  const code = (item.Item1 ?? item.code ?? "").trim();
  const name = (item.Item2 ?? item.name ?? "").trim();
  if (!code) return null;

  const academic = getTermAcademicDates(code);
  return {
    id: code,
    code,
    name: name || code,
    startDate: academic?.classesStart,
    endDate: academic?.classesEnd,
  };
}

export function normalizeTerms(
  items: Array<{ Item1?: string; Item2?: string }>,
): Term[] {
  const terms: Term[] = [];
  for (const item of items) {
    const term = normalizeTerm(item);
    if (term) terms.push(term);
  }
  return terms;
}
