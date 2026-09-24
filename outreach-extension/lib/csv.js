// CSV parsing and lead normalization for Sales Navigator-style exports.
// Sales Navigator has no native CSV export; the scraper tools people use
// (Evaboot, Phantombuster, etc.) name columns differently, so headers are
// matched against a list of aliases and can be remapped in the UI.

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], records: [] };
  const headers = nonEmpty[0].map(h => h.trim());
  const records = nonEmpty.slice(1).map(r => {
    const rec = {};
    headers.forEach((h, idx) => { rec[h] = (r[idx] ?? '').trim(); });
    return rec;
  });
  return { headers, records };
}

export const FIELDS = {
  firstName: ['first name', 'firstname', 'first_name', 'given name'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
  fullName: ['full name', 'fullname', 'full_name', 'name', 'contact name'],
  email: ['email', 'email address', 'work email', 'professional email', 'business email', 'emails', 'e-mail'],
  company: ['company', 'company name', 'current company', 'account name', 'organization', 'companyname'],
  title: ['title', 'job title', 'position', 'current title', 'headline', 'job_title'],
  linkedinUrl: ['linkedin url', 'profile url', 'linkedin profile', 'linkedin profile url', 'sales navigator url', 'linkedin', 'profileurl', 'linkedinprofileurl'],
};

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function guessMapping(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELDS)) {
    const aliasSet = aliases.map(norm);
    mapping[field] =
      headers.find(h => aliasSet.includes(norm(h))) ||
      headers.find(h => aliasSet.some(a => a.length > 4 && norm(h).includes(a))) ||
      '';
  }
  return mapping;
}

export function toLead(record, mapping) {
  const get = f => (mapping[f] ? record[mapping[f]] || '' : '');
  let firstName = get('firstName');
  let lastName = get('lastName');
  let fullName = get('fullName');
  if (!fullName) fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName && !firstName && !lastName) {
    const parts = fullName.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }
  // Some exports put several emails in one cell.
  const email = (get('email').split(/[;,\s]+/).find(e => e.includes('@')) || '').toLowerCase();
  return {
    ...record, // raw columns stay available as {{Column Header}}
    firstName, lastName, fullName, email,
    company: get('company'),
    title: get('title'),
    linkedinUrl: get('linkedinUrl'),
  };
}

export function leadKey(lead) {
  return lead.email || lead.linkedinUrl || `${lead.fullName}|${lead.company}`.toLowerCase();
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
