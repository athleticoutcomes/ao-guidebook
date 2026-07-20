/*
 * Receives guidebook form submissions and creates a page in the matching
 * Notion database (single source of truth). Needs env var NOTION_TOKEN, an
 * internal Notion integration shared with the three databases below.
 */
const DBS = {
  refer:    '1c724e77f1c9803692f4f31ad5507ef0', // Refer a Friend
  pt:       '1b024e77f1c980ea84dedfb0ca1ff9b3', // Personal Training Requests
  ptherapy: '1b524e77f1c980e393c4d7694aa622f8', // Physical Therapy Requests
};

const T = (v) => (v == null ? '' : String(v)).trim();
const rt = (v) => (T(v) ? [{ text: { content: T(v).slice(0, 1900) } }] : []);
const ms = (arr) => arr.filter(Boolean).map((name) => ({ name }));

function buildProps(type, d) {
  if (type === 'refer') {
    const p = {
      'Form': { title: rt(d['your-name'] || 'Guidebook referral') },
      'Member': { rich_text: rt(d['your-name']) },
      'Member email': { rich_text: rt(d['your-email']) },
      'Referral': { rich_text: rt(d['friend-name']) },
      'Referral Email': { rich_text: rt(d['friend-email']) },
      'Referral Phone': { rich_text: rt(d['friend-phone']) },
      'Bday': { rich_text: rt(d['friend-bday']) },
    };
    if (T(d['consent'])) {
      p['I promise I told my friend I gave their personal information to AO & they can expect an email from the gym!'] = { multi_select: ms(['Of course I did!']) };
    }
    return p;
  }
  if (type === 'pt') {
    const p = {
      'Name': { title: rt(d['name']) },
      'Email': { rich_text: rt(d['email']) },
      'Phone number': { phone_number: T(d['phone']) || null },
      'Looking for': { rich_text: rt(d['looking-for']) },
      'Let us know your ideal days and times to train. Providing a variety of options will give us the best chance to get you in ASAP! (M-F only)': { rich_text: rt(d['availability']) },
      'Status': { status: { name: 'New' } },
    };
    if (T(d['per-week'])) p['Trainings per week'] = { multi_select: ms([T(d['per-week'])]) };
    if (T(d['can-text'])) p['Can we text?'] = { multi_select: ms([T(d['can-text'])]) };
    if (T(d['referral-source'])) p['Referral source'] = { multi_select: ms([T(d['referral-source'])]) };
    return p;
  }
  if (type === 'ptherapy') {
    const p = {
      'Name': { title: rt(d['name']) },
      'Email': { rich_text: rt(d['email']) },
      'Phone Number': { phone_number: T(d['phone']) || null },
      'Issue(s)': { rich_text: rt(d['issue']) },
      'How Soon?': { rich_text: rt(d['how-soon']) },
      'Status': { status: { name: 'New' } },
    };
    if (T(d['availability'])) p['Availability'] = { multi_select: ms([T(d['availability'])]) };
    if (T(d['contact-pref'])) p['Can we email or text you? '] = { multi_select: ms([T(d['contact-pref'])]) };
    if (T(d['referral-source'])) p['Referral Source'] = { multi_select: ms([T(d['referral-source'])]) };
    return p;
  }
  return null;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const token = process.env.NOTION_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_TOKEN is not set' }) };

  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) { d = {}; }
  if (T(d['bot-field'])) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };

  const type = T(d['formType']);
  const dbId = DBS[type];
  const props = buildProps(type, d);
  if (!dbId || !props) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown form type' }) };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { statusCode: 502, body: JSON.stringify({ error: 'Notion write failed', detail: detail.slice(0, 500) }) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
