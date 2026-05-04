const MAX_CLASSES = 24;
const MAX_SUBJECTS_PER_CLASS = 16;

let poolPromise;

const DEFAULT_HOMEWORK_UPDATE = {
  headline: 'Home Homework Update (Term Three)',
  overview: {
    term: 'Term Three',
    week: '2',
    day: 'Tuesday',
    dateLabel: '28th April, 2026',
    updatedLabel: 'Daily classroom homework notice'
  },
  calendar: {
    title: 'Term Three School Calendar PDF',
    description: 'Upload the latest school calendar PDF and then update the link in this file to make it available here for families.',
    href: 'images/mega_img/SAYS 3RD TERM CALENDAR 2026 - P_021551.pdf',
    fileLabel: 'SAYS 3rd Term Calendar 2026'
  },
  notes: [
    'Homework updates can be refreshed every school day after lessons.',
    'Parents and guardians can check the class cards below for the subjects given that day.',
    'When the latest calendar PDF is ready, update the link and the download button will go live automatically.'
  ],
  classes: [
    {
      name: 'Basic 4 Orchid',
      subjects: ['Twi', 'History', 'Science']
    },
    {
      name: 'Basic 4 Lavender',
      subjects: ['Science', 'French', 'History']
    },
    {
      name: 'Basic 4 Marigold',
      subjects: ['History', 'Maths']
    }
  ]
};

function getConnectionString() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
  const trimmed = String(raw).trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function hasDatabaseConnection() {
  return Boolean(getConnectionString());
}

function getAdminPassword() {
  return String(process.env.HOMEWORK_ADMIN_PASSWORD || '').trim();
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = import('@vercel/postgres').then(function ({ createPool }) {
      return createPool({
        connectionString: getConnectionString()
      });
    });
  }

  return poolPromise;
}

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body || '{}');
    } catch (error) {
      return {};
    }
  }

  return body || {};
}

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeArray(values, maxItems, mapFn) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .slice(0, maxItems)
    .map(mapFn)
    .filter(Boolean);
}

function sanitizePayload(input) {
  const overview = input && input.overview ? input.overview : {};
  const calendar = input && input.calendar ? input.calendar : {};

  const classes = normalizeArray(input && input.classes, MAX_CLASSES, function (entry) {
    const name = normalizeText(entry && entry.name, 120);
    const subjects = normalizeArray(entry && entry.subjects, MAX_SUBJECTS_PER_CLASS, function (subject) {
      return normalizeText(subject, 80);
    });

    if (!name || !subjects.length) {
      return null;
    }

    return {
      name,
      subjects
    };
  });

  return {
    headline: normalizeText(input && input.headline, 160) || DEFAULT_HOMEWORK_UPDATE.headline,
    overview: {
      term: normalizeText(overview.term, 80) || '-',
      week: normalizeText(overview.week, 30) || '-',
      day: normalizeText(overview.day, 40) || '-',
      dateLabel: normalizeText(overview.dateLabel, 80) || '-',
      updatedLabel: normalizeText(overview.updatedLabel, 120) || 'Daily classroom homework notice'
    },
    calendar: {
      title: normalizeText(calendar.title, 120) || 'School Calendar PDF',
      description: normalizeText(calendar.description, 220) || '',
      href: normalizeText(calendar.href, 260),
      fileLabel: normalizeText(calendar.fileLabel, 120) || 'Latest calendar file'
    },
    notes: normalizeArray(input && input.notes, 10, function (note) {
      return normalizeText(note, 220);
    }),
    classes: classes.length ? classes : DEFAULT_HOMEWORK_UPDATE.classes
  };
}

function isAuthorized(password) {
  const configured = getAdminPassword();
  return configured && password === configured;
}

async function ensureTable() {
  const db = await getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS homework_updates (
      singleton_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  return db;
}

async function getStoredPayload() {
  if (!hasDatabaseConnection()) {
    return {
      payload: DEFAULT_HOMEWORK_UPDATE,
      source: 'fallback',
      updatedAt: null
    };
  }

  const db = await ensureTable();
  const result = await db.query(`
    SELECT payload, updated_at
    FROM homework_updates
    WHERE singleton_key = $1
    LIMIT 1;
  `, ['latest']);

  if (!result.rowCount) {
    return {
      payload: DEFAULT_HOMEWORK_UPDATE,
      source: 'fallback',
      updatedAt: null
    };
  }

  return {
    payload: sanitizePayload(result.rows[0].payload),
    source: 'database',
    updatedAt: result.rows[0].updated_at
  };
}

async function savePayload(payload) {
  const db = await ensureTable();

  const result = await db.query(`
    INSERT INTO homework_updates (singleton_key, payload, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (singleton_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    RETURNING updated_at;
  `, ['latest', JSON.stringify(payload)]);

  return result.rows[0].updated_at;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET') {
    try {
      const stored = await getStoredPayload();
      return response.status(200).json({
        success: true,
        payload: stored.payload,
        source: stored.source,
        updatedAt: stored.updatedAt
      });
    } catch (error) {
      console.error('homework-updates GET failed', {
        message: error && error.message ? error.message : 'unknown',
        code: error && error.code ? error.code : 'n/a'
      });

      return response.status(200).json({
        success: true,
        payload: DEFAULT_HOMEWORK_UPDATE,
        source: 'fallback',
        updatedAt: null
      });
    }
  }

  if (request.method === 'POST') {
    try {
      if (!getAdminPassword()) {
        return response.status(503).json({
          error: 'HOMEWORK_ADMIN_PASSWORD is not configured yet in Vercel.'
        });
      }

      const body = parseBody(request.body);
      const password = normalizeText(body.password, 120);
      const verifyOnly = Boolean(body.verifyOnly);

      if (!isAuthorized(password)) {
        return response.status(401).json({
          error: 'Incorrect admin password.'
        });
      }

      if (verifyOnly) {
        return response.status(200).json({
          success: true,
          verified: true
        });
      }

      if (!hasDatabaseConnection()) {
        return response.status(503).json({
          error: 'Homework updates database is not connected yet. Add DATABASE_URL in Vercel first.'
        });
      }

      const payload = sanitizePayload(body.payload || {});
      const updatedAt = await savePayload(payload);

      return response.status(200).json({
        success: true,
        payload,
        updatedAt
      });
    } catch (error) {
      console.error('homework-updates POST failed', {
        message: error && error.message ? error.message : 'unknown',
        code: error && error.code ? error.code : 'n/a'
      });

      return response.status(500).json({
        error: 'Could not save homework update right now. Please try again.'
      });
    }
  }

  response.setHeader('Allow', 'GET, POST');
  return response.status(405).json({ error: 'Method not allowed' });
}
