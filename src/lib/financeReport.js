import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { MONTHS, isInMonth } from "./finance";

// Single source of truth for the monthly financial-report PDF, used by both the
// Dashboard (quick download) and the Financial Reports page. Pass the full record
// arrays plus the target month/year — filtering happens here so both callers stay
// consistent. `fmt` formats currency; `churchName` heads the document.
export function generateFinancialReportPDF({
  monthIdx,
  year,
  giving = [],
  expenditures = [],
  fmt = (n) => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`,
  churchName = "ChurchConnect",
}) {
  const filteredGiving = giving.filter((g) => isInMonth(g.date, monthIdx, year));
  const filteredExp = expenditures.filter((e) => isInMonth(e.date, monthIdx, year));

  const totalTithes = filteredGiving.filter((g) => g.type === "tithe").reduce((s, g) => s + (g.amount || 0), 0);
  const totalOfferings = filteredGiving.filter((g) => g.type !== "tithe").reduce((s, g) => s + (g.amount || 0), 0);
  const approvedExp = filteredExp.filter((e) => e.approval_status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = totalTithes + totalOfferings;
  const netBalance = totalIncome - approvedExp;

  const doc = new jsPDF();
  const title = `${MONTHS[monthIdx]} ${year} — Financial Report`;

  // Giving by type breakdown
  const givingByType = {};
  filteredGiving.forEach((g) => {
    const t = g.type || "other";
    givingByType[t] = (givingByType[t] || 0) + (g.amount || 0);
  });
  // Expenditures by category breakdown
  const expByCategory = {};
  filteredExp.filter((e) => e.approval_status === "approved").forEach((e) => {
    const c = e.category || "other";
    expByCategory[c] = (expByCategory[c] || 0) + (e.amount || 0);
  });
  const genDate = format(new Date(), "MMMM d, yyyy");

  doc.setFillColor(45, 106, 79);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(churchName || "ChurchConnect", 15, 18);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(title, 15, 30);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Generated: ${genDate}`, 15, 48);

  // Summary box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(15, 55, 180, 50, 3, 3, "FD");
  doc.setTextColor(45, 106, 79);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Summary", 20, 65);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`Total Tithes:`, 20, 76); doc.text(fmt(totalTithes), 120, 76);
  doc.text(`Total Offerings:`, 20, 84); doc.text(fmt(totalOfferings), 120, 84);
  doc.text(`Total Expenditures:`, 20, 92); doc.text(fmt(approvedExp), 120, 92);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(netBalance >= 0 ? 45 : 200, netBalance >= 0 ? 106 : 30, netBalance >= 0 ? 79 : 30);
  doc.text(`Net Balance:`, 20, 100); doc.text(fmt(netBalance), 120, 100);

  // Giving by type breakdown
  let yb = 115;
  doc.setTextColor(45, 106, 79); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Giving by Type", 15, yb); yb += 7;
  doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "bold");
  doc.text("Type", 15, yb); doc.text("Amount", 155, yb); yb += 4;
  doc.setDrawColor(200, 200, 200); doc.line(15, yb, 195, yb); yb += 5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
  Object.entries(givingByType).forEach(([type, amt]) => {
    doc.text(type.replace(/_/g, " "), 15, yb); doc.text(fmt(amt), 155, yb); yb += 6;
  });

  // Expenditures by category breakdown
  yb += 4;
  if (yb > 230) { doc.addPage(); yb = 20; }
  doc.setTextColor(45, 106, 79); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Expenditures by Category", 15, yb); yb += 7;
  doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "bold");
  doc.text("Category", 15, yb); doc.text("Amount", 155, yb); yb += 4;
  doc.line(15, yb, 195, yb); yb += 5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
  Object.entries(expByCategory).forEach(([cat, amt]) => {
    doc.text(cat, 15, yb); doc.text(fmt(amt), 155, yb); yb += 6;
  });

  // Giving details
  let y = 118;
  doc.setTextColor(45, 106, 79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Giving Records", 15, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Member", 15, y); doc.text("Date", 80, y); doc.text("Type", 115, y); doc.text("Amount", 165, y);
  y += 4; doc.setDrawColor(200, 200, 200); doc.line(15, y, 195, y); y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  filteredGiving.slice(0, 30).forEach((g) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text((g.member_name || "Unknown").substring(0, 30), 15, y);
    doc.text(g.date || "", 80, y);
    doc.text((g.type || "").replace(/_/g, " "), 115, y);
    doc.text(fmt(g.amount), 155, y);
    y += 7;
  });

  // Expenditures
  y += 6;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setTextColor(45, 106, 79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Approved Expenditures", 15, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Description", 15, y); doc.text("Category", 90, y); doc.text("Date", 135, y); doc.text("Amount", 165, y);
  y += 4; doc.line(15, y, 195, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  filteredExp.filter((e) => e.approval_status === "approved").slice(0, 25).forEach((e) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text((e.description || "").substring(0, 35), 15, y);
    doc.text((e.category || ""), 90, y);
    doc.text(e.date || "", 135, y);
    doc.text(fmt(e.amount), 155, y);
    y += 7;
  });

  doc.save(`financial-report-${MONTHS[monthIdx].toLowerCase()}-${year}.pdf`);
}
