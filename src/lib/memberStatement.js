import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { parseLocalDate } from "./finance";

const KIND_LABEL = { tithe: "Tithe", welfare: "Welfare", offering: "Offering" };

// Per-member giving statement (tithe or welfare history), printable + downloadable.
// `records` should already be filtered to one member and one giving type.
export function generateMemberStatementPDF({
  member,
  records = [],
  kind = "tithe",
  fmt = (n) => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`,
  churchName = "ChurchConnect",
  mode = "save", // "save" downloads a file; "print" opens a print-ready tab
}) {
  const kindLabel = KIND_LABEL[kind] || (kind.charAt(0).toUpperCase() + kind.slice(1));
  const memberName = `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";

  // Newest first for display; compute total + range over everything.
  const sorted = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const total = sorted.reduce((s, r) => s + (r.amount || 0), 0);
  const dated = sorted.map((r) => parseLocalDate(r.date)).filter(Boolean).sort((a, b) => a - b);
  const rangeText = dated.length
    ? `${format(dated[0], "MMM d, yyyy")} – ${format(dated[dated.length - 1], "MMM d, yyyy")}`
    : "—";

  const doc = new jsPDF();
  const genDate = format(new Date(), "MMMM d, yyyy");

  // Header band
  doc.setFillColor(45, 106, 79);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(churchName || "ChurchConnect", 15, 18);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`${kindLabel} Statement`, 15, 30);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Generated: ${genDate}`, 15, 48);

  // Member + summary box
  const boxTop = 55;
  const boxHeight = 44;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(15, boxTop, 180, boxHeight, 3, 3, "FD");
  doc.setTextColor(45, 106, 79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(memberName, 20, boxTop + 11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  if (member?.phone) doc.text(`Phone: ${member.phone}`, 20, boxTop + 20);
  if (member?.email) doc.text(`Email: ${member.email}`, 110, boxTop + 20);
  doc.text(`Records: ${sorted.length}`, 20, boxTop + 29);
  doc.text(`Period: ${rangeText}`, 60, boxTop + 29);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 106, 79);
  doc.text(`Total ${kindLabel}: ${fmt(total)}`, 20, boxTop + 38);

  // Detail table (paginated, header reprints on page breaks)
  let y = boxTop + boxHeight + 12;
  const cols = [["Date", 15], ["Amount", 60], ["Method", 100], ["Service / Event", 140]];
  const drawHeader = () => {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "bold");
    cols.forEach(([t, x]) => doc.text(t, x, y));
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
  };

  doc.setTextColor(45, 106, 79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${kindLabel} History`, 15, y);
  y += 7;
  drawHeader();

  if (sorted.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.text(`No ${kindLabel.toLowerCase()} records for this member.`, 15, y);
  } else {
    sorted.forEach((r) => {
      if (y > 280) { doc.addPage(); y = 20; drawHeader(); }
      doc.text(String(r.date || ""), 15, y);
      doc.text(fmt(r.amount), 60, y);
      doc.text(String(r.payment_method || "").replace(/_/g, " "), 100, y);
      doc.text(String(r.service_or_event || "").substring(0, 28), 140, y);
      y += 6;
    });
  }

  const safe = memberName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (mode === "print") {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  } else {
    doc.save(`${safe || "member"}-${kind}-statement.pdf`);
  }
}
