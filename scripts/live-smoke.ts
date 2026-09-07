/**
 * Optional live smoke test against University of Guelph Colleague Self-Service.
 * Not part of CI. Run: npm run smoke
 */
import {
  getCourseProvider,
  clearProviderCache,
} from "../src/lib/guelph/provider";

async function main() {
  clearProviderCache();
  const provider = getCourseProvider();

  const terms = await provider.getTerms();
  console.log(
    "terms:",
    terms.map((t) => `${t.code}=${t.name}`).join(", "),
  );
  if (
    !terms.some((t) => t.code === "F26") ||
    !terms.some((t) => t.code === "W27")
  ) {
    throw new Error("Expected F26 and W27 in live terms list.");
  }

  // Diverse departments — not CIS-only. Codes must be currently offered.
  const checks: Array<{ term: string; q: string; expectCode?: string }> = [
    { term: "F26", q: "CIS*2030", expectCode: "CIS*2030" },
    { term: "F26", q: "MATH*1080", expectCode: "MATH*1080" },
    { term: "F26", q: "ENGG*1500", expectCode: "ENGG*1500" },
    { term: "F26", q: "PSYC*1000", expectCode: "PSYC*1000" },
    { term: "F26", q: "HK*2270", expectCode: "HK*2270" },
    { term: "F26", q: "FRHD*1010", expectCode: "FRHD*1010" },
    { term: "F26", q: "CHEM*1040", expectCode: "CHEM*1040" },
    { term: "F26", q: "BIOL*1090", expectCode: "BIOL*1090" },
    { term: "F26", q: "SOC*1100", expectCode: "SOC*1100" },
    { term: "F26", q: "ENGL*1080", expectCode: "ENGL*1080" },
    { term: "F26", q: "ACCT*1220", expectCode: "ACCT*1220" },
    { term: "F26", q: "STAT*2040", expectCode: "STAT*2040" },
    { term: "F26", q: "BIOC" },
    { term: "F26", q: "Organic" },
    { term: "W27", q: "CIS*1500", expectCode: "CIS*1500" },
    { term: "W27", q: "STAT*2040", expectCode: "STAT*2040" },
  ];

  for (const check of checks) {
    const hits = await provider.searchCourses(check.term, check.q);
    console.log(
      `${check.term} search "${check.q}" => ${hits.length} hits` +
        (hits[0] ? ` (e.g. ${hits[0].code})` : ""),
    );
    if (!hits.length) {
      throw new Error(`No search hits for ${check.term} / ${check.q}`);
    }
    if (check.expectCode && !hits.some((h) => h.code === check.expectCode)) {
      throw new Error(
        `Expected ${check.expectCode} in results for ${check.q}, got ${hits
          .slice(0, 5)
          .map((h) => h.code)
          .join(", ")}`,
      );
    }
  }

  for (const code of [
    "CIS*2030",
    "MATH*1080",
    "PSYC*1000",
    "ENGG*1500",
    "CHEM*1040",
    "FRHD*1010",
  ]) {
    const course = await provider.getCourseSections("F26", code);
    console.log(
      `F26 sections ${course.code}: ${course.sections.length} sections, meetings=${course.sections[0]?.meetings.length ?? 0}`,
    );
    if (!course.sections.length) throw new Error(`No sections for ${code}`);
  }

  console.log("smoke ok — multi-department catalog search works");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
