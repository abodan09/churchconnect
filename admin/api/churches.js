import { requireAdmin, getPrisma, cors } from './_auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const prisma = getPrisma();

  // ── GET: list all churches ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { search } = req.query;
    const churches = await prisma.church.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
    });

    const ids = churches.map(c => c.id);
    const [memberCounts, settings, admins] = await Promise.all([
      prisma.member.groupBy({
        by: ['church_id'],
        where: { church_id: { in: ids } },
        _count: { id: true },
      }),
      prisma.churchSettings.findMany({
        where: { church_id: { in: ids } },
        select: { church_id: true, church_name: true, logo_url: true },
      }),
      prisma.userProfile.findMany({
        where: { church_id: { in: ids }, role: 'super_admin' },
        select: { church_id: true, clerkId: true },
      }),
    ]);

    const countMap = Object.fromEntries(memberCounts.map(m => [m.church_id, m._count.id]));
    const settingsMap = Object.fromEntries(settings.map(s => [s.church_id, s]));
    const adminMap = Object.fromEntries(admins.map(a => [a.church_id, a]));

    return res.status(200).json(churches.map(c => ({
      ...c,
      member_count: countMap[c.id] || 0,
      settings: settingsMap[c.id] || null,
      admin: adminMap[c.id] || null,
    })));
  }

  // ── PATCH: update plan or is_active ────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { plan, is_active } = req.body || {};
    const data = {};
    if (plan !== undefined) data.plan = plan;
    if (is_active !== undefined) data.is_active = is_active;
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });

    const church = await prisma.church.update({ where: { id }, data });
    return res.status(200).json(church);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
