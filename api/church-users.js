/**
 * Admin-gated user management for a church (cloud).
 *   GET   /api/church-users            → list the church's login users (enriched with Clerk name/email)
 *   POST  /api/church-users            → invite by email OR create directly; assign a role; optionally link a Member
 *   PATCH /api/church-users            → change a user's role / department
 *
 * The app DB (UserProfile.role + church_id) is the source of truth. Clerk
 * publicMetadata { church_id, role, department_id, member_id } is only a
 * one-time provisioning hint consumed on first login by api/me.js.
 *
 * Role writes NEVER go through the generic entities API (which is not role-gated);
 * they go here, behind an admin check + church-boundary check + a last-super_admin
 * guard, with a grant matrix (only super_admin may grant super_admin/pastor_admin).
 */
import { verifyToken, createClerkClient } from '@clerk/backend';
import { randomBytes } from 'crypto';
import prisma from '../src/lib/prisma.js';

let _clerk = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

const ROLES = ['super_admin', 'pastor_admin', 'finance_officer', 'department_head', 'data_entry_staff', 'member'];
// Roles only a super_admin may grant/revoke.
const ELEVATED = new Set(['super_admin', 'pastor_admin']);
const APP_URL = process.env.APP_URL || 'https://church.frozenbit.eu';

function tempPassword() {
  // 24 url-safe chars — strong, one-time; created with skipPasswordChecks so a
  // random-but-unusual string is never rejected by Clerk's strength/breach filter.
  return randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) + 'A9!';
}

// This Clerk instance requires a username on direct user creation. Auto-generate
// a unique one from the email local-part + random suffix (the user can change it later).
function makeUsername(email) {
  const base = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  return (base + randomBytes(4).toString('hex')).slice(0, 30);
}

function primaryEmail(u) {
  const id = u.primaryEmailAddressId;
  const hit = (u.emailAddresses || []).find(e => e.id === id) || (u.emailAddresses || [])[0];
  return hit?.emailAddress || null;
}
function displayName(u) {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return n || u.username || primaryEmail(u) || 'Unknown';
}

async function authCaller(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return { error: 401 };
  const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
    ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
    : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];
  let clerkId;
  try {
    const payload = await verifyToken(auth.split(' ')[1], { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties });
    clerkId = payload?.sub;
    if (!clerkId) throw new Error('No sub');
  } catch { return { error: 401 }; }
  const profile = await prisma.userProfile.findUnique({ where: { clerkId } });
  if (!profile || !ELEVATED.has(profile.role)) return { error: 403 };
  return { clerkId, profile };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const caller = await authCaller(req);
  if (caller.error) return res.status(caller.error).json({ error: caller.error === 401 ? 'Unauthorized' : 'Forbidden: admin access required' });
  const churchId = caller.profile.church_id;
  const callerIsSuper = caller.profile.role === 'super_admin';

  try {
    // ── LIST ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const profiles = await prisma.userProfile.findMany({ where: { church_id: churchId } });
      const ids = profiles.map(p => p.clerkId).filter(Boolean);
      const identities = {};
      if (ids.length) {
        try {
          const resp = await getClerk().users.getUserList({ userId: ids, limit: 500 });
          const users = resp?.data || resp || [];
          for (const u of users) identities[u.id] = { name: displayName(u), email: primaryEmail(u), imageUrl: u.imageUrl || null };
        } catch (e) { console.warn('[church-users] clerk enrich failed:', e?.message); }
      }
      const rows = profiles.map(p => ({
        id: p.id,
        clerkId: p.clerkId,
        role: p.role,
        departmentId: p.departmentId || null,
        isSelf: p.clerkId === caller.clerkId,
        name: identities[p.clerkId]?.name || '—',
        email: identities[p.clerkId]?.email || null,
        imageUrl: identities[p.clerkId]?.imageUrl || null,
      }));
      return res.status(200).json(rows);
    }

    // ── INVITE / CREATE ─────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { mode, email, first_name, last_name, role, department_id, member_id } = req.body || {};
      if (!email?.trim()) return res.status(400).json({ error: 'email is required' });
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });
      if (ELEVATED.has(role) && !callerIsSuper) return res.status(403).json({ error: 'Only a super admin can grant admin roles.' });
      const departmentId = role === 'department_head' ? (department_id || null) : null;
      const metadata = { church_id: churchId, role, department_id: departmentId, member_id: member_id || null };

      if (mode === 'create') {
        const pw = tempPassword();
        let user;
        try {
          user = await getClerk().users.createUser({
            emailAddress: [email.trim()],
            username: makeUsername(email),
            password: pw,
            firstName: first_name || undefined,
            lastName: last_name || undefined,
            publicMetadata: metadata,
            skipPasswordChecks: true,
          });
        } catch (e) {
          const msg = e?.errors?.[0]?.message || e?.message || 'Could not create user';
          return res.status(400).json({ error: /exists|taken|duplicate/i.test(msg) ? 'A user with that email already exists.' : msg });
        }
        const profile = await prisma.userProfile.upsert({
          where: { clerkId: user.id },
          create: { clerkId: user.id, church_id: churchId, role, departmentId },
          update: { church_id: churchId, role, departmentId },
        });
        if (member_id) {
          await prisma.member.updateMany({ where: { id: member_id, church_id: churchId }, data: { user_id: user.id } }).catch(() => {});
        }
        return res.status(201).json({ ok: true, mode: 'create', clerkId: user.id, profileId: profile.id, tempPassword: pw, email: email.trim() });
      }

      // default = invite by email
      try {
        const invitation = await getClerk().invitations.createInvitation({
          emailAddress: email.trim(),
          publicMetadata: metadata,
          redirectUrl: `${APP_URL}/accept-invite`,
          ignoreExisting: false,
        });
        return res.status(201).json({ ok: true, mode: 'invite', invitationId: invitation.id, email: email.trim() });
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Could not send invitation';
        return res.status(400).json({ error: /exists|already|duplicate/i.test(msg) ? 'That email already has an account or a pending invite.' : msg });
      }
    }

    // ── SET ROLE / DEPARTMENT ────────────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { target_clerk_id, role, department_id } = req.body || {};
      if (!target_clerk_id) return res.status(400).json({ error: 'target_clerk_id is required' });
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });

      const target = await prisma.userProfile.findUnique({ where: { clerkId: target_clerk_id } });
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (target.church_id !== churchId) return res.status(403).json({ error: 'Forbidden: user belongs to a different church' });

      // Only super_admin may grant OR revoke elevated roles.
      if ((ELEVATED.has(role) || ELEVATED.has(target.role)) && !callerIsSuper) {
        return res.status(403).json({ error: 'Only a super admin can change admin roles.' });
      }
      // Never demote the last super_admin of a church.
      if (target.role === 'super_admin' && role !== 'super_admin') {
        const supers = await prisma.userProfile.count({ where: { church_id: churchId, role: 'super_admin' } });
        if (supers <= 1) return res.status(400).json({ error: 'A church must keep at least one super admin.' });
      }

      const departmentId = role === 'department_head' ? (department_id || null) : null;
      const updated = await prisma.userProfile.update({ where: { clerkId: target_clerk_id }, data: { role, departmentId } });
      return res.status(200).json({ ok: true, clerkId: target_clerk_id, role: updated.role, departmentId: updated.departmentId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[church-users]', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
}
