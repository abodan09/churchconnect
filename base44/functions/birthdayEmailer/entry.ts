import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role for scheduled/automated runs
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const members = await base44.asServiceRole.entities.Member.list();

    const todayBirthdays = members.filter(m => {
      if (!m.date_of_birth || !m.email) return false;
      const parts = m.date_of_birth.split("-");
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return month === todayMonth && day === todayDay;
    });

    const results = [];
    for (const member of todayBirthdays) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: member.email,
        subject: `🎂 Happy Birthday, ${member.first_name}!`,
        body: `Dear ${member.first_name},\n\nWishing you a wonderful birthday from all of us at ChurchConnect!\n\nMay this special day be filled with joy and blessings.\n\nWith love,\nChurchConnect Family`
      });
      results.push({ member: `${member.first_name} ${member.last_name}`, email: member.email });
    }

    return Response.json({ sent: results.length, recipients: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});