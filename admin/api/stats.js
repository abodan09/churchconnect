import { requireAdmin, getPrisma, cors } from './_auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const prisma = getPrisma();

  const [totalChurches, activeChurches, totalMembers, planGroups, allChurches] = await Promise.all([
    prisma.church.count(),
    prisma.church.count({ where: { is_active: true } }),
    prisma.member.count(),
    prisma.church.groupBy({ by: ['plan'], _count: { id: true } }),
    prisma.church.findMany({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
  ]);

  // Monthly growth — last 6 months
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleString('en', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  allChurches.forEach(c => {
    const d = new Date(c.createdAt);
    const slot = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (slot) slot.count++;
  });

  return res.status(200).json({
    totalChurches,
    activeChurches,
    inactiveChurches: totalChurches - activeChurches,
    totalMembers,
    plans: planGroups.map(p => ({ plan: p.plan, count: p._count.id })),
    monthlyGrowth: months.map(({ label, count }) => ({ label, count })),
  });
}
