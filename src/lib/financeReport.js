import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { MONTHS, isInMonth, isInRange, parseLocalDate } from "./finance";

// Single source of truth for the financial-report PDF, used by both the
// Dashboard (quick monthly download) and the Financial Reports page. Pass the
// full record arrays plus EITHER a target month (monthIdx + year) OR a custom
// date range (from + to, "YYYY-MM-DD"; takes precedence) — filtering happens
// here so both callers stay consistent. `fmt` formats currency; `churchName`
// heads the document.
//
// splitOthers: when true, "Offerings" means only type==="offering" and a separate
// "Others" line captures every other non-tithe giving type (special_offering,
// thanksgiving, building_fund, …). When false (legacy), "Offerings" is all
// non-tithe giving. The net balance is identical either way.
export function generateFinancialReportPDF({
  monthIdx,
  year,
  from = null,
  to = null,
  giving = [],
  expenditures = [],
  fmt = (n) => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`,
  churchName = "ChurchConnect",
  splitOthers = false,
}) {
  const usingRange = !!(from && to);
  const inPeriod = (dateStr) => (usingRange ? isInRange(dateStr, from, to) : isInMonth(dateStr, monthIdx, year));
  const periodLabel = usingRange
    ? `${format(parseLocalDate(from), "d MMM yyyy")} to ${format(parseLocalDate(to), "d MMM yyyy")}`
    : `${MONTHS[monthIdx]} ${year}`;
  const fileSlug = usingRange ? `${from}_to_${to}` : `${MONTHS[monthIdx].toLowerCase()}-${year}`;
  const filteredGiving = giving.filter((g) => inPeriod(g.date));
  const filteredExp = expenditures.filter((e) => inPeriod(e.date));

  const sum = (arr) => arr.reduce((s, r) => s + (r.amount || 0), 0);
  const totalTithes = sum(filteredGiving.filter((g) => g.type === "tithe"));
  const totalOfferings = sum(filteredGiving.filter((g) => (splitOthers ? g.type === "offering" : g.type !== "tithe")));
  const totalOthers = splitOthers ? sum(filteredGiving.filter((g) => g.type !== "tithe" && g.type !== "offering")) : 0;
  const approvedExp = sum(filteredExp.filter((e) => e.approval_status === "approved"));
  const totalIncome = totalTithes + totalOfferings + totalOthers;
  const netBalance = totalIncome - approvedExp;

  const givingByType = {};
  filteredGiving.forEach((g) => {
    const t = g.type || "other";
    givingByType[t] = (givingByType[t] || 0) + (g.amount || 0);
  });
  const expByCategory = {};
  filteredExp.filter((e) => e.approval_status === "approved").forEach((e) => {
    const c = e.category || "other";
    expByCategory[c] = (expByCategory[c] || 0) + (e.amount || 0);
  });

  const doc = new jsPDF();
  const genDate = format(new Date(), "MMMM d, yyyy");

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(45, 106, 79);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(churchName || "ChurchConnect", 15, 18);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`${periodLabel} — Financial Report`, 15, 30);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Generated: ${genDate}`, 15, 48);

  // ── Summary box ─────────────────────────────────────────────────────────────
  const summaryRows = [
    ["Total Tithes:", totalTithes],
    ["Total Offerings:", totalOfferings],
    ...(splitOthers ? [["Total Others:", totalOthers]] : []),
    ["Total Expenditures:", approvedExp],
  ];
  const boxTop = 55;
  const boxHeight = 20 + (summaryRows.length + 1) * 8; // header + rows + net line
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(15, boxTop, 180, boxHeight, 3, 3, "FD");
  doc.setTextColor(45, 106, 79);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Summary", 20, boxTop + 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  let sy = boxTop + 21;
  summaryRows.forEach(([label, val]) => {
    doc.text(label, 20, sy);
    doc.text(fmt(val), 120, sy);
    sy += 8;
  });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(netBalance >= 0 ? 45 : 200, netBalance >= 0 ? 106 : 30, netBalance >= 0 ? 79 : 30);
  doc.text("Net Balance:", 20, sy);
  doc.text(fmt(netBalance), 120, sy);

  // ── Detail sections (sequential; column headers reprint on page breaks) ─────
  let y = boxTop + boxHeight + 12;
  let currentCols = null;
  const MAX_ROWS = 40;

  const drawColumnHeader = () => {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "bold");
    currentCols.forEach(([t, x]) => doc.text(t, x, y));
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
  };
  // Start a section, keeping its heading + column header (+ room for a row)
  // together on one page.
  const startSection = (label, cols) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setTextColor(45, 106, 79);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, 15, y);
    y += 7;
    currentCols = cols;
    drawColumnHeader();
  };
  const row = (cells) => {
    if (y > 278) { doc.addPage(); y = 20; drawColumnHeader(); }
    cells.forEach(([t, x]) => doc.text(String(t), x, y));
    y += 6;
  };
  const note = (text) => {
    if (y > 278) { doc.addPage(); y = 20; }
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.text(text, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    y += 6;
  };
  const moreNote = (total) => {
    if (total > MAX_ROWS) note(`…and ${total - MAX_ROWS} more record${total - MAX_ROWS === 1 ? "" : "s"} (totals above are complete).`);
  };

  startSection("Giving by Type", [["Type", 15], ["Amount", 155]]);
  const givingTypeEntries = Object.entries(givingByType);
  if (givingTypeEntries.length === 0) note("No giving records for this period.");
  else givingTypeEntries.forEach(([type, amt]) => row([[type.replace(/_/g, " "), 15], [fmt(amt), 155]]));
  y += 6;

  startSection("Expenditures by Category", [["Category", 15], ["Amount", 155]]);
  const expCatEntries = Object.entries(expByCategory);
  if (expCatEntries.length === 0) note("No approved expenditures for this period.");
  else expCatEntries.forEach(([cat, amt]) => row([[cat, 15], [fmt(amt), 155]]));
  y += 6;

  startSection("Giving Records", [["Giver", 15], ["Date", 80], ["Type", 115], ["Amount", 155]]);
  if (filteredGiving.length === 0) note("No giving records for this period.");
  else {
    filteredGiving.slice(0, MAX_ROWS).forEach((g) => row([
      [(g.member_name || "Unknown").substring(0, 30), 15],
      [g.date || "", 80],
      [(g.type || "").replace(/_/g, " "), 115],
      [fmt(g.amount), 155],
    ]));
    moreNote(filteredGiving.length);
  }
  y += 6;

  startSection("Approved Expenditures", [["Description", 15], ["Category", 90], ["Date", 130], ["Amount", 155]]);
  const approved = filteredExp.filter((e) => e.approval_status === "approved");
  if (approved.length === 0) note("No approved expenditures for this period.");
  else {
    approved.slice(0, MAX_ROWS).forEach((e) => row([
      [(e.description || "").substring(0, 35), 15],
      [e.category || "", 90],
      [e.date || "", 130],
      [fmt(e.amount), 155],
    ]));
    moreNote(approved.length);
  }

  doc.save(`financial-report-${fileSlug}.pdf`);
}
