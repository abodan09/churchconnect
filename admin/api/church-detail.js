import { createClerkClient } from '@clerk/backend';
import { requireAdmin, getPrisma, cors } from './_auth.js';

let _clerk = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const prisma = getPrisma();

  const [church, settings, recentMembers, adminProfile, totalMembers] = await Promise.all([
    prisma.church.findUnique({ where: { id } }),
    prisma.churchSettings.findUnique({ where: { church_id: id } }),
    prisma.member.findMany({
      where: { church_id: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, first_name: true, last_name: true,
        email: true, membership_status: true, createdAt: true,
      },
    }),
    prisma.userProfile.findFirst({
      where: { church_id: id, role: 'super_admin' },
      select: { clerkId: true, createdAt: true },
    }),
    prisma.member.count({ where: { church_id: id } }),
  ]);

  if (!church) return res.status(404).json({ error: 'Not found' });

  // Fetch full contact details from Clerk for the registrant/admin
  let adminUser = null;
  if (adminProfile?.clerkId) {
    try {
      const cu = await getClerk().users.getUser(adminProfile.clerkId);
      const primaryEmail = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId);
      const primaryPhone = cu.phoneNumbers.find(p => p.id === cu.primaryPhoneNumberId);
      const social = cu.externalAccounts[0];
      adminUser = {
        clerkId: adminProfile.clerkId,
        registeredAt: adminProfile.createdAt,
        name: [cu.firstName, cu.lastName].filter(Boolean).join(' ') || null,
        email: primaryEmail?.emailAddress || cu.emailAddresses[0]?.emailAddress || null,
        phone: primaryPhone?.phoneNumber || cu.phoneNumbers[0]?.phoneNumber || null,
        imageUrl: cu.imageUrl || null,
        socialProvider: social?.provider || null,
        socialEmail: social?.emailAddress || null,
      };
    } catch {
      adminUser = { clerkId: adminProfile.clerkId, registeredAt: adminProfile.createdAt };
    }
  }

  return res.status(200).json({ church, settings, recentMembers, adminUser, totalMembers });
}
