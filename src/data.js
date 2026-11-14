import { readFileSync } from "node:fs";
import { csvParse } from "d3-dsv";

/**
 * Parses a "wide" CSV: first column is the category name, every other
 * column header is a time label (e.g. a year) whose cell is the value
 * at that point in time.
 *
 * `source` is either a local file path or an http(s) URL.
 *
 * Returns { dateLabels, series } where series is
 * [{ name: string, values: number[] }], values aligned with dateLabels.
 */
export async function loadWideCsv(source) {
  const raw = await readCsvText(source);
  const rows = csvParse(raw);
  if (rows.length === 0) {
    throw new Error(`CSV "${source}" has no data rows.`);
  }

  const [nameColumn, ...dateLabels] = rows.columns;
  if (!nameColumn || dateLabels.length === 0) {
    throw new Error(
      "CSV must have a category column followed by at least one time column."
    );
  }

  const series = rows.map((row) => {
    const name = row[nameColumn];
    if (!name) {
      throw new Error(`Row is missing a value in the "${nameColumn}" column.`);
    }
    const values = dateLabels.map((label) => {
      const raw = row[label];
      const value = Number(raw);
      if (raw === undefined || raw === "" || Number.isNaN(value)) {
        throw new Error(
          `Non-numeric value "${raw}" for "${name}" in column "${label}".`
        );
      }
      return value;
    });
    return { name, values };
  });

  return { dateLabels, series };
}

async function readCsvText(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch CSV from "${source}": ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  return readFileSync(source, "utf8");
}
