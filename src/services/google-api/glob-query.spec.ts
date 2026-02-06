import { describe, expect, test } from "bun:test";
import { globToQuery } from "./glob-query";

describe("globToQuery", () => {
  test("exact name → name = query", () => {
    const { query, filter } = globToQuery("report.pdf");
    expect(query).toBe("name = 'report.pdf'");
    expect(filter("report.pdf")).toBe(true);
    expect(filter("Report.PDF")).toBe(true);
    expect(filter("other.pdf")).toBe(false);
  });

  test("*.ext → name contains '.ext'", () => {
    const { query, filter } = globToQuery("*.pdf");
    expect(query).toBe("name contains '.pdf'");
    expect(filter("report.pdf")).toBe(true);
    expect(filter("report.txt")).toBe(false);
  });

  test("prefix* → name contains 'prefix'", () => {
    const { query, filter } = globToQuery("report*");
    expect(query).toBe("name contains 'report'");
    expect(filter("report.pdf")).toBe(true);
    expect(filter("report-v2.doc")).toBe(true);
    expect(filter("my-report")).toBe(false);
  });

  test("*substring* → name contains 'substring'", () => {
    const { query, filter } = globToQuery("*budget*");
    expect(query).toBe("name contains 'budget'");
    expect(filter("budget.xlsx")).toBe(true);
    expect(filter("Q1-budget-draft.xlsx")).toBe(true);
    expect(filter("other.xlsx")).toBe(false);
  });

  test("prefix*.ext → both contains clauses", () => {
    const { query, filter } = globToQuery("report*.pdf");
    expect(query).toBe("name contains 'report' and name contains '.pdf'");
    expect(filter("report-v2.pdf")).toBe(true);
    expect(filter("report.pdf")).toBe(true);
    expect(filter("report.txt")).toBe(false);
    expect(filter("my-report.pdf")).toBe(false);
  });

  test("strips **/ prefix", () => {
    const { query } = globToQuery("**/*.pdf");
    expect(query).toBe("name contains '.pdf'");
  });

  test("escapes single quotes", () => {
    const { query } = globToQuery("it's*");
    expect(query).toBe("name contains 'it\\'s'");
  });

  test("? matches single character", () => {
    const { filter } = globToQuery("file?.txt");
    expect(filter("file1.txt")).toBe(true);
    expect(filter("fileA.txt")).toBe(true);
    expect(filter("file12.txt")).toBe(false);
  });
});
