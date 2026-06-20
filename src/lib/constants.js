// Shared domain constants for ChurchConnect v2.

export const ROLES = [
  'super_admin',
  'pastor_admin',
  'finance_officer',
  'department_head',
  'data_entry_staff',
  'member',
];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  pastor_admin: 'Pastor / Admin',
  finance_officer: 'Finance Officer',
  department_head: 'Department Head',
  data_entry_staff: 'Data Entry Staff',
  member: 'Member',
};

// Navigation items keyed by the path; `roles` lists who may see each item.
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', roles: ROLES },
  { label: 'Members', path: '/members', icon: 'Users', roles: ['super_admin', 'pastor_admin', 'data_entry_staff', 'department_head', 'finance_officer'] },
  { label: 'Giving', path: '/giving', icon: 'HandCoins', roles: ['super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'] },
  { label: 'Expenditures', path: '/expenditures', icon: 'Receipt', roles: ['super_admin', 'pastor_admin', 'finance_officer', 'department_head'] },
  { label: 'Properties', path: '/properties', icon: 'Building2', roles: ['super_admin', 'pastor_admin', 'finance_officer'] },
  { label: 'Departments', path: '/departments', icon: 'Layers', roles: ['super_admin'] },
  { label: 'Sermons', path: '/sermons', icon: 'Mic2', roles: ['super_admin', 'pastor_admin', 'department_head'] },
  { label: 'Events', path: '/events', icon: 'CalendarDays', roles: ['super_admin', 'pastor_admin', 'department_head'] },
  { label: 'Attendance', path: '/attendance', icon: 'ClipboardCheck', roles: ['super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'] },
  { label: 'Attendance Analytics', path: '/attendance-analytics', icon: 'PieChart', roles: ['super_admin', 'pastor_admin', 'department_head'] },
  { label: 'Reports', path: '/reports', icon: 'FileBarChart2', roles: ['super_admin', 'pastor_admin', 'finance_officer'] },
  { label: 'My Portal', path: '/portal', icon: 'Home', roles: ['member'] },
  { label: 'Church Settings', path: '/church-settings', icon: 'Settings', roles: ['super_admin'] },
];

export function navForRole(role) {
  const r = role === 'admin' ? 'super_admin' : role || 'member';
  return NAV_ITEMS.filter((item) => item.roles.includes(r));
}

export function canAccessPath(role, path) {
  const r = role === 'admin' ? 'super_admin' : role || 'member';
  const item = NAV_ITEMS.find((i) => i.path === path);
  return item ? item.roles.includes(r) : true;
}

// Enum option lists (mirror the SQL enums).
export const MEMBERSHIP_STATUS = ['active', 'inactive', 'visitor'];
export const GIVING_TYPES = ['tithe', 'offering', 'special_offering', 'thanksgiving', 'building_fund'];
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque'];
export const EXPENDITURE_CATEGORIES = ['utilities', 'salaries', 'maintenance', 'outreach', 'events', 'equipment', 'welfare', 'administration', 'other'];
export const APPROVAL_STATUS = ['pending', 'approved', 'rejected'];
export const ATTENDANCE_STATUS = ['present', 'late', 'excused'];
export const EVENT_TYPES = ['service', 'meeting', 'activity', 'special', 'outreach', 'training'];
export const PROPERTY_TYPES = ['building', 'land', 'vehicle', 'equipment', 'furniture', 'electronics', 'other'];
export const PROPERTY_CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'decommissioned'];

export const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'GHS', symbol: 'GH₵' },
  { code: 'NGN', symbol: '₦' },
  { code: 'KES', symbol: 'KSh' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
];

export const LANGUAGES = ['en', 'fr', 'es', 'pt', 'it', 'de'];

// Pretty-print an enum value: 'special_offering' → 'Special Offering'.
export function humanize(value) {
  if (!value) return '';
  return String(value)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
