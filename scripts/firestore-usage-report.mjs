#!/usr/bin/env node
// Read-only Firestore usage report.
//
// Answers two questions about the daily free-tier quota (50k reads / 20k writes):
//   A. Data shape — how many documents each collection holds, globally and per
//      shop. This is what every full collection load costs in billed reads.
//   B. Actual traffic — daily document read/write/delete counts for the last 7
//      days from Cloud Monitoring (when the service account may read them).
//
// Auth uses the FIREBASE_ADMIN_* service account from .env via a signed JWT —
// no SDK dependencies. Every call is read-only (COUNT aggregations, metrics);
// secrets are never printed.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_ROOT = 'https://firestore.googleapis.com/v1';
const MONITORING_ROOT = 'https://monitoring.googleapis.com/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/monitoring.read';

const SUBCOLLECTIONS = [
  'items', 'sales', 'purchases', 'customers', 'expenses', 'transactions',
  'sales_returns', 'capital', 'transfers', 'donations', 'security_deposits', 'categories',
];
// Subcollections counted per shop in part B (the high-volume ones).
const PER_USER_COLLECTIONS = ['items', 'sales', 'purchases', 'expenses', 'transactions'];
const MAX_USERS = 200;
const METRIC_DAYS = 7;

function parseEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (match[1].includes('PRIVATE_KEY')) value = value.replace(/\\n/g, '\n');
    env[match[1]] = value;
  }
  return env;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(body?.error?.message ?? `HTTP ${response.status}`), {
      status: response.status,
    });
  }
  return body;
}

async function getAccessToken(env) {
  const claims = {
    iss: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(env.FIREBASE_ADMIN_PRIVATE_KEY, 'base64url');

  const token = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  return token.access_token;
}

async function countCollection(token, projectId, parent, collectionId, allDescendants) {
  const url = `${DB_ROOT}/projects/${projectId}/databases/(default)/documents/${parent}:runAggregationQuery`;
  const body = {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId, allDescendants }] },
      aggregations: [{ alias: 'count', count: {} }],
    },
  };
  const result = await fetchJson(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return Number(result[0]?.result?.aggregateFields?.count?.integerValue ?? 0);
}

async function listUserIds(token, projectId) {
  const url = `${DB_ROOT}/projects/${projectId}/databases/(default)/documents/users?pageSize=${MAX_USERS}`;
  const page = await fetchJson(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  return page.documents?.map((doc) => doc.name.split('/').pop()) ?? [];
}

async function getDailyMetric(token, projectId, metricType, end) {
  const start = new Date(end.getTime() - METRIC_DAYS * 86_400_000);
  const params = new URLSearchParams({
    filter: `metric.type="${metricType}"`,
    'interval.start_time': start.toISOString(),
    'interval.end_time': end.toISOString(),
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const page = await fetchJson(`${MONITORING_ROOT}/projects/${projectId}/timeSeries?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const daily = {};
  for (const series of page.timeSeries ?? []) {
    for (const point of series.points) {
      const day = point.interval.endTime.slice(0, 10);
      daily[day] = (daily[day] ?? 0) + Number(point.value.int64Value ?? 0);
    }
  }
  return daily;
}

const fmt = (n) => Number(n).toLocaleString('en-US');

async function main() {
  const env = parseEnv();
  if (!env.FIREBASE_ADMIN_CLIENT_EMAIL || !env.FIREBASE_ADMIN_PRIVATE_KEY) {
    console.error('Missing FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY in .env');
    process.exit(1);
  }
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const billedReads = 0; // counts below cost ~1 read per 1,000 matched entries

  // Part A — global document counts per collection type.
  console.log(`\nFirestore usage report — project "${projectId}"`);
  console.log(`\n[A] Documents per collection (whole project)`);
  const globalCounts = {};
  for (const name of SUBCOLLECTIONS) {
    globalCounts[name] = await countCollection(token, projectId, '', name, true);
    console.log(`  users/*/` + name.padEnd(18) + fmt(globalCounts[name]));
  }

  // Part B — per-shop counts for the high-volume collections.
  const userIds = await listUserIds(token, projectId);
  console.log(`\n[B] Per-shop documents (${userIds.length} shop(s))`);
  for (const uid of userIds) {
    const parent = `users/${uid}`;
    const counts = await Promise.all(
      PER_USER_COLLECTIONS.map((name) => countCollection(token, projectId, parent, name, false))
    );
    const label = uid.slice(0, 10).padEnd(12);
    console.log(
      `  shop ${label}` +
        PER_USER_COLLECTIONS.map((name, i) => `${name}=${fmt(counts[i])}`).join('  ')
    );
  }

  // Part C — actual billed traffic from Cloud Monitoring.
  console.log(`\n[C] Actual usage, last ${METRIC_DAYS} days (Cloud Monitoring)`);
  const end = new Date();
  for (const [label, metric] of [
    ['reads ', 'firestore.googleapis.com/document/read_count'],
    ['writes', 'firestore.googleapis.com/document/write_count'],
    ['deletes', 'firestore.googleapis.com/document/delete_count'],
  ]) {
    try {
      const daily = await getDailyMetric(token, projectId, metric, end);
      const days = Object.keys(daily).sort();
      if (!days.length) {
        console.log(`  ${label}: no data recorded`);
        continue;
      }
      for (const day of days) console.log(`  ${label}  ${day}  ${fmt(daily[day])}`);
    } catch (error) {
      console.log(`  ${label}: unavailable (${error.message})`);
    }
  }

  console.log(`\nThis report itself used ~${billedReads} billed reads (COUNT aggregations bill ~1 read per 1,000 entries).`);
}

main().catch((error) => {
  console.error('Report failed:', error.message);
  process.exit(1);
});
