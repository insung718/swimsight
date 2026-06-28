#!/usr/bin/env python3
"""Train SwimSight's conservative prediction priors from meet spreadsheets.

Usage:
  python3 scripts/train-prediction-model.py "/path/to/Swimming times.xlsx"

The script accepts the current wide workbook format:
  Meet name with year/course | 50 Free | 100 Free | ...

It prints a JSON model summary that can be checked against the committed
src/lib/trained-prediction-model.ts artifact. The runtime app does not need
Python or pandas.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import csv
import zipfile
from xml.etree import ElementTree


EVENT_LABELS = {
    "Free": "Freestyle",
    "Fly": "Butterfly",
    "Back": "Backstroke",
    "Breast": "Breaststroke",
    "IM": "IM",
}


def parse_time(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    if ":" in text:
        minutes, seconds = text.split(":", 1)
        return int(minutes) * 60 + float(seconds)
    return float(text)


def event_name(column: str) -> str:
    distance, *stroke_parts = column.strip().split()
    stroke = " ".join(stroke_parts)
    return f"{distance} {EVENT_LABELS.get(stroke, stroke)}"


def column_index(cell_reference: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_reference.upper())
    index = 0
    for letter in letters:
        index = index * 26 + (ord(letter) - ord("A") + 1)
    return index - 1


def read_xlsx_rows(path: Path) -> list[list[object]]:
    namespace = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(path) as workbook_zip:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook_zip.namelist():
            shared_root = ElementTree.fromstring(workbook_zip.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("main:si", namespace):
                shared_strings.append("".join(text.text or "" for text in item.findall(".//main:t", namespace)))

        workbook_root = ElementTree.fromstring(workbook_zip.read("xl/workbook.xml"))
        first_sheet = workbook_root.find("main:sheets/main:sheet", namespace)
        if first_sheet is None:
            return []
        relation_id = first_sheet.attrib[f"{{{namespace['rel']}}}id"]
        rels_root = ElementTree.fromstring(workbook_zip.read("xl/_rels/workbook.xml.rels"))
        target = None
        for relationship in rels_root.findall("pkg:Relationship", namespace):
            if relationship.attrib.get("Id") == relation_id:
                target = relationship.attrib["Target"]
                break
        if not target:
            return []
        target = target.lstrip("/")
        sheet_path = target if target.startswith("xl/") else f"xl/{target}"
        sheet_root = ElementTree.fromstring(workbook_zip.read(sheet_path))

        rows: list[list[object]] = []
        for row in sheet_root.findall(".//main:sheetData/main:row", namespace):
            cells: dict[int, object] = {}
            for cell in row.findall("main:c", namespace):
                ref = cell.attrib.get("r", "")
                value_node = cell.find("main:v", namespace)
                inline_node = cell.find("main:is/main:t", namespace)
                value: object | None = None
                if inline_node is not None:
                    value = inline_node.text
                elif value_node is not None:
                    raw_value = value_node.text or ""
                    if cell.attrib.get("t") == "s":
                        value = shared_strings[int(raw_value)]
                    else:
                        try:
                            value = float(raw_value)
                        except ValueError:
                            value = raw_value
                cells[column_index(ref)] = value
            if cells:
                max_index = max(cells)
                rows.append([cells.get(index) for index in range(max_index + 1)])
        return rows


def read_csv_rows(path: Path) -> list[list[object]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.reader(handle))


def normalize_rows(path: Path) -> list[dict[str, object]]:
    table = read_xlsx_rows(path) if path.suffix.lower() == ".xlsx" else read_csv_rows(path)
    if not table:
        return []
    headers = [str(header) for header in table[0]]
    rows: list[dict[str, object]] = []
    for index, row in enumerate(table[1:]):
        meet = str(row[0] if row else "")
        year_match = re.search(r"(20\d{2})", meet)
        course_match = re.search(r"\b(SCM|LCM|SCY)\b", meet)
        if not year_match or not course_match:
            continue
        year = int(year_match.group(1))
        course = course_match.group(1)
        ordinal = (year - 2022) * 365 + index * 12
        for column_index_value, column in enumerate(headers[1:], start=1):
            seconds = parse_time(row[column_index_value] if column_index_value < len(row) else None)
            if seconds is not None:
                rows.append({
                    "event": event_name(str(column)),
                    "course": course,
                    "seconds": seconds,
                    "ordinal": ordinal,
                })
    return rows


def fit_priors(rows: list[dict[str, object]]) -> dict[str, dict[str, float | int]]:
    grouped: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        grouped[(str(row["event"]), str(row["course"]))].append(row)

    priors: dict[str, dict[str, float | int]] = {}
    for (event, course), values in sorted(grouped.items()):
        values = sorted(values, key=lambda item: float(item["ordinal"]))
        if len(values) < 2:
            continue
        first = float(values[0]["seconds"])
        latest = float(values[-1]["seconds"])
        best = min(float(item["seconds"]) for item in values)
        days = max(float(values[-1]["ordinal"]) - float(values[0]["ordinal"]), 1)
        annual_latest = max(0, (first - latest) / first) * (365 / days)
        annual_best = max(0, (first - best) / first) * (365 / days)
        observed_annual = max(annual_latest, annual_best)
        conservative_cap = max(0.012, min(0.085, observed_annual * 0.70)) if observed_annual else 0.018
        if len(values) < 3:
            conservative_cap = min(conservative_cap, 0.045)

        xs = [float(item["ordinal"]) - float(values[0]["ordinal"]) for item in values]
        ys = [float(item["seconds"]) for item in values]
        n = len(xs)
        sum_x = sum(xs)
        sum_y = sum(ys)
        sum_xy = sum(x * y for x, y in zip(xs, ys))
        sum_xx = sum(x * x for x in xs)
        denominator = n * sum_xx - sum_x * sum_x
        slope = (n * sum_xy - sum_x * sum_y) / denominator if denominator else 0

        priors[f"{event}__{course}"] = {
            "sampleCount": len(values),
            "annualImprovementCap": round(conservative_cap, 4),
            "observedAnnualImprovement": round(observed_annual, 4),
            "slopeSecondsPerDay": round(slope, 5),
            "firstTime": round(first, 2),
            "bestTime": round(best, 2),
            "latestTime": round(latest, 2),
        }
    return priors


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Pass at least one .xlsx training file.")
    rows: list[dict[str, object]] = []
    sources: list[str] = []
    for raw_path in sys.argv[1:]:
        path = Path(raw_path)
        sources.append(path.name)
        rows.extend(normalize_rows(path))
    priors = fit_priors(rows)
    print(json.dumps({"sources": sources, "normalizedResultCount": len(rows), "priors": priors}, indent=2))


if __name__ == "__main__":
    main()
