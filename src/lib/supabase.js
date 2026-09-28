import { createClient } from '@supabase/supabase-js';

const cleanEnvValue = (value) => String(value || '')
  .trim()
  .replace(/^[A-Z0-9_]+\s*=\s*/, '')
  .replace(/^['"]|['"]$/g, '')
  .trim();

const url = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const anonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

export const cloudEnabled = Boolean(url && anonKey);
export const supabase = cloudEnabled ? createClient(url, anonKey) : null;

const mapDbReport = (row) => ({
  ...row,
  production: row.production || [],
  wheat: row.wheat || [],
  sales: row.sales || [],
  collections: row.collections || [],
});

export async function cloudSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw profileError;
  return { user: data.user, profile };
}

export async function cloudSignOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function cloudLoadSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', data.session.user.id)
    .maybeSingle();
  return profile ? { user: data.session.user, profile } : null;
}

export async function cloudLoadReports() {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .order('version', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDbReport);
}

export async function cloudPublishReport(report, userId) {
  const { data: versions, error: versionError } = await supabase
    .from('daily_reports')
    .select('version')
    .eq('report_date', report.report_date)
    .order('version', { ascending: false })
    .limit(1);
  if (versionError) throw versionError;
  const version = (versions?.[0]?.version || 0) + 1;
  const { error: deleteError } = await supabase
    .from('daily_reports')
    .delete()
    .eq('report_date', report.report_date);
  if (deleteError) throw deleteError;
  const payload = {
    report_date: report.report_date,
    version,
    status: 'PUBLISHED',
    note: report.note || '',
    source_file: report.source_file || '',
    production: report.production || [],
    wheat: report.wheat || [],
    sales: report.sales || [],
    collections: report.collections || [],
    created_by: userId,
    published_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('daily_reports').insert(payload).select('*').single();
  if (error) throw error;
  return mapDbReport(data);
}

export async function cloudClearReports() {
  const { error } = await supabase.from('daily_reports').delete().not('id', 'is', null);
  if (error) throw error;
}
