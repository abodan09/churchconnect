import { useState, useEffect } from "react";
import { entities, sendEmail } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileBarChart2, Download, Send } from "lucide-react";
import StatCard from "@/components/StatCard";
import { HandCoins } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = [2023, 2024, 2025, 2026].map(String);

export default function FinancialReportsPage() {
  const [giving, setGiving] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [emailTarget, setEmailTarget] = useState("");
  const [generated, setGenerated] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [g, e] = await Promise.all([entities.Giving.list("-date", 2000), entities.Expenditure.list("-date", 2000)]);
    setGiving(g); setExpenditures(e); setLoading(false);
  }

  const monthIdx = parseInt(month);
  const yearNum = parseInt(year);

  const filteredGiving = giving.filter(g => {
    if (!g.date) return false;
    const d = new Date(g.date);
    return d.getMonth() === monthIdx && d.getFullYear() === yearNum;
  });

  const filteredExp = expenditures.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === monthIdx && d.getFullYear() === yearNum;
  });

  const totalTithes = filteredGiving.filter(g=>g.type==="tithe").reduce((s,g)=>s+(g.amount||0),0);
  const totalOfferings = filteredGiving.filter(g=>g.type!=="tithe").reduce((s,g)=>s+(g.amount||0),0);
  const totalIncome = totalTithes + totalOfferings;
  const approvedExp = filteredExp.filter(e=>e.approval_status==="approved").reduce((s,e)=>s+(e.amount||0),0);
  const netBalance = totalIncome - approvedExp;

  const fmt = n => `€${Number(n||0).toLocaleString("en",{minimumFractionDigits:2})}`;

  function generatePDF() {
    const doc = new jsPDF();
    const title = `${MONTHS[monthIdx]} ${year} — Financial Report`;

    // Giving by type breakdown
    const givingByType = {};
    filteredGiving.forEach(g => {
      const t = g.type || "other";
      givingByType[t] = (givingByType[t] || 0) + (g.amount || 0);
    });
    // Expenditures by category breakdown
    const expByCategory = {};
    filteredExp.filter(e => e.approval_status === "approved").forEach(e => {
      const c = e.category || "other";
      expByCategory[c] = (expByCategory[c] || 0) + (e.amount || 0);
    });
    const genDate = format(new Date(), "MMMM d, yyyy");

    doc.setFillColor(45, 106, 79);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ChurchConnect CRM", 15, 18);
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
    doc.setFontSize(9); doc.setTextColor(100,100,100); doc.setFont("helvetica","bold");
    doc.text("Type", 15, yb); doc.text("Amount", 155, yb); yb += 4;
    doc.setDrawColor(200,200,200); doc.line(15, yb, 195, yb); yb += 5;
    doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
    Object.entries(givingByType).forEach(([type, amt]) => {
      doc.text(type.replace(/_/g," "), 15, yb); doc.text(fmt(amt), 155, yb); yb += 6;
    });

    // Expenditures by category breakdown
    yb += 4;
    if (yb > 230) { doc.addPage(); yb = 20; }
    doc.setTextColor(45, 106, 79); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Expenditures by Category", 15, yb); yb += 7;
    doc.setFontSize(9); doc.setTextColor(100,100,100); doc.setFont("helvetica","bold");
    doc.text("Category", 15, yb); doc.text("Amount", 155, yb); yb += 4;
    doc.line(15, yb, 195, yb); yb += 5;
    doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
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
    filteredGiving.slice(0, 30).forEach(g => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text((g.member_name||"Unknown").substring(0,30), 15, y);
      doc.text(g.date||"", 80, y);
      doc.text((g.type||"").replace(/_/g," "), 115, y);
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
    filteredExp.filter(e=>e.approval_status==="approved").slice(0,25).forEach(e => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text((e.description||"").substring(0,35), 15, y);
      doc.text((e.category||""), 90, y);
      doc.text(e.date||"", 135, y);
      doc.text(fmt(e.amount), 155, y);
      y += 7;
    });

    doc.save(`financial-report-${MONTHS[monthIdx].toLowerCase()}-${year}.pdf`);
    setGenerated(true);
  }

  async function handleSendEmail() {
    if (!emailTarget) return;
    setSending(true);
    const body = `
      <h2>ChurchConnect — ${MONTHS[monthIdx]} ${year} Financial Report</h2>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Item</th><th>Amount</th></tr>
        <tr><td>Total Tithes</td><td>${fmt(totalTithes)}</td></tr>
        <tr><td>Total Offerings</td><td>${fmt(totalOfferings)}</td></tr>
        <tr><td>Total Income</td><td><strong>${fmt(totalIncome)}</strong></td></tr>
        <tr><td>Approved Expenditures</td><td>${fmt(approvedExp)}</td></tr>
        <tr><td><strong>Net Balance</strong></td><td><strong>${fmt(netBalance)}</strong></td></tr>
      </table>
      <p style="color:gray;font-size:12px">Generated by ChurchConnect CRM on ${format(new Date(),"MMMM d, yyyy")}</p>
    `;
    await sendEmail({
      to: emailTarget,
      subject: `Financial Report — ${MONTHS[monthIdx]} ${year}`,
      body,
      from_name: "ChurchConnect"
    });
    setSending(false);
    alert("Report sent successfully!");
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold">Financial Reports</h1><p className="text-muted-foreground text-sm">Generate and share monthly financial summaries</p></div>

      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <h2 className="font-semibold mb-4">Select Period</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m,i)=><SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Tithes" value={fmt(totalTithes)} icon={HandCoins} color="green" />
        <StatCard title="Offerings" value={fmt(totalOfferings)} icon={HandCoins} color="blue" />
        <StatCard title="Expenditures" value={fmt(approvedExp)} icon={HandCoins} color="red" />
        <StatCard title="Net Balance" value={fmt(netBalance)} icon={HandCoins} color={netBalance >= 0 ? "green" : "red"} />
      </div>

      <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
        <h2 className="font-semibold">Generate PDF Report</h2>
        <p className="text-muted-foreground text-sm">{filteredGiving.length} giving records and {filteredExp.length} expenditure records for {MONTHS[monthIdx]} {year}.</p>
        <Button onClick={generatePDF} className="bg-primary text-primary-foreground gap-2">
          <Download className="w-4 h-4" />Download PDF Report
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
        <h2 className="font-semibold">Send Report by Email</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <Label>Recipient Email</Label>
            <input type="email" value={emailTarget} onChange={e=>setEmailTarget(e.target.value)} placeholder="pastor@church.org" className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Button onClick={handleSendEmail} disabled={!emailTarget || sending} className="bg-primary text-primary-foreground gap-2">
            <Send className="w-4 h-4" />{sending ? "Sending..." : "Send Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}
