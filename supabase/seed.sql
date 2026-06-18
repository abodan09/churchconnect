-- =====================================================================
-- ChurchConnect v2 — Seed data
--
-- OPTIONAL / DEV-ONLY. This file is for local development and demos.
-- Do NOT run it against production.
--
-- Notes / caveats:
--   * Rows here are inserted with elevated privileges (the SQL editor /
--     CLI run as the postgres role, which bypasses RLS), so the policies
--     in 0001_init.sql do not block these inserts.
--   * We do NOT seed profiles directly. profiles rows are created
--     automatically by the on_auth_user_created trigger when real users
--     sign up through Supabase Auth. Seeding profiles without matching
--     auth.users rows would violate the FK to auth.users.
--   * Therefore FK columns that point at profiles (head_user_id, user_id,
--     recorded_by, created_by, approved_by, checked_in_by) are left NULL.
--   * Safe to re-run: church_settings uses the singleton guard; other
--     inserts are wrapped so duplicates are skipped where practical.
-- =====================================================================

-- ---- church_settings (singleton) -------------------------------------
insert into public.church_settings (church_name, language, currency_code, currency_symbol)
values ('Grace Community Church', 'en', 'EUR', '€')
on conflict (is_singleton) do nothing;

-- ---- departments ------------------------------------------------------
-- Use fixed UUIDs so other seed rows can reference them deterministically.
insert into public.departments (id, name, description, head_name, media_upload_enabled, allowed_media_types, is_active, color)
values
  ('11111111-1111-1111-1111-111111111111', 'Worship',       'Music and worship ministry',        'Sarah Bennett', true,  'both',  true, '#7c3aed'),
  ('22222222-2222-2222-2222-222222222222', 'Youth',         'Teens and young adults',            'Daniel Owusu',  true,  'video', true, '#2563eb'),
  ('33333333-3333-3333-3333-333333333333', 'Finance',       'Stewardship and accounts',          'Mary Adjei',    false, 'none',  true, '#16a34a'),
  ('44444444-4444-4444-4444-444444444444', 'Outreach',      'Evangelism and community service',  'John Mensah',   true,  'audio', true, '#ea580c')
on conflict (id) do nothing;

-- ---- members ----------------------------------------------------------
insert into public.members (id, first_name, last_name, email, phone, department_id, join_date, membership_status, gender)
values
  ('aaaaaaa1-0000-0000-0000-000000000001', 'Grace',   'Asante',   'grace.asante@example.com',  '+233200000001', '11111111-1111-1111-1111-111111111111', '2022-01-15', 'active',   'female'),
  ('aaaaaaa1-0000-0000-0000-000000000002', 'Kwame',   'Boateng',  'kwame.boateng@example.com', '+233200000002', '22222222-2222-2222-2222-222222222222', '2023-03-02', 'active',   'male'),
  ('aaaaaaa1-0000-0000-0000-000000000003', 'Linda',   'Osei',     'linda.osei@example.com',    '+233200000003', '44444444-4444-4444-4444-444444444444', '2021-11-20', 'inactive', 'female'),
  ('aaaaaaa1-0000-0000-0000-000000000004', 'Visitor', 'Sample',   null,                        null,            null,                                   '2026-06-01', 'visitor',  null)
on conflict (id) do nothing;

-- ---- giving -----------------------------------------------------------
insert into public.giving (member_id, member_name, date, amount, type, payment_method, service_or_event)
values
  ('aaaaaaa1-0000-0000-0000-000000000001', 'Grace Asante',  '2026-06-07', 150.00, 'tithe',           'mobile_money', 'Sunday Service'),
  ('aaaaaaa1-0000-0000-0000-000000000002', 'Kwame Boateng', '2026-06-07',  40.00, 'offering',        'cash',         'Sunday Service'),
  ('aaaaaaa1-0000-0000-0000-000000000001', 'Grace Asante',  '2026-06-14', 100.00, 'building_fund',   'bank_transfer','Sunday Service'),
  (null,                                   'Anonymous',     '2026-06-14',  25.00, 'thanksgiving',    'cash',         'Midweek Service');

-- ---- expenditures -----------------------------------------------------
insert into public.expenditures (date, category, description, amount, department_id, approval_status)
values
  ('2026-06-05', 'utilities',   'June electricity bill',           220.50, null,                                   'approved'),
  ('2026-06-10', 'equipment',   'New microphone for worship team', 180.00, '11111111-1111-1111-1111-111111111111', 'pending'),
  ('2026-06-12', 'outreach',    'Community food drive supplies',   340.00, '44444444-4444-4444-4444-444444444444', 'approved');

-- ---- events -----------------------------------------------------------
insert into public.events (id, title, description, department_id, start_datetime, end_datetime, location, event_type, is_public)
values
  ('eeeeeee1-0000-0000-0000-000000000001', 'Sunday Worship Service', 'Weekly main service',        '11111111-1111-1111-1111-111111111111', '2026-06-21 09:00+00', '2026-06-21 11:30+00', 'Main Auditorium', 'service', true),
  ('eeeeeee1-0000-0000-0000-000000000002', 'Youth Game Night',       'Fellowship and games',       '22222222-2222-2222-2222-222222222222', '2026-06-27 18:00+00', '2026-06-27 21:00+00', 'Youth Hall',      'activity', false)
on conflict (id) do nothing;

-- ---- attendance -------------------------------------------------------
insert into public.attendance (event_id, event_name, event_date, member_id, member_name, department_id, status)
values
  ('eeeeeee1-0000-0000-0000-000000000001', 'Sunday Worship Service', '2026-06-21', 'aaaaaaa1-0000-0000-0000-000000000001', 'Grace Asante',  '11111111-1111-1111-1111-111111111111', 'present'),
  ('eeeeeee1-0000-0000-0000-000000000001', 'Sunday Worship Service', '2026-06-21', 'aaaaaaa1-0000-0000-0000-000000000002', 'Kwame Boateng', '22222222-2222-2222-2222-222222222222', 'late');

-- ---- sermons ----------------------------------------------------------
insert into public.sermons (title, description, preacher, date, department_id, media_type, duration_minutes, tags)
values
  ('Walking in Faith',  'A study on Hebrews 11', 'Pastor James Mensah', '2026-06-07', '11111111-1111-1111-1111-111111111111', 'audio', 42, array['faith','hebrews']),
  ('The Heart of Worship', 'Worship as a lifestyle', 'Sarah Bennett',    '2026-06-14', '11111111-1111-1111-1111-111111111111', 'video', 38, array['worship']);

-- ---- properties -------------------------------------------------------
insert into public.properties (type, name, description, location_or_serial, purchase_date, purchase_value, current_condition, assigned_department_id)
values
  ('building',  'Main Auditorium',   'Primary worship building',   'Plot 12, Church Rd', '2010-05-01', 250000.00, 'good',      null),
  ('vehicle',   'Church Bus',        '30-seater outreach bus',     'GR-4521-22',         '2019-08-15',  45000.00, 'fair',      '44444444-4444-4444-4444-444444444444'),
  ('equipment', 'PA System',         'Main sound system',          'SN-PA-0091',         '2021-02-10',   8000.00, 'excellent', '11111111-1111-1111-1111-111111111111');

-- =====================================================================
-- End of seed.sql (dev-only)
-- =====================================================================
