const SUBJECTS = [
  'english', 'urdu', 'mathematics', 'science', 'islamiat',
  'tarjama-tul-quran', 'ethics', 'drawing', 'geography',
  'history', 'computer-science'
];

const SOURCES = ['book', 'guide', 'other'];

function respond(status, code, message, data) {
  const body = { code, message };
  if (data !== undefined) body.data = data;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    // 1. Method check
    if (request.method !== 'POST') {
      return respond(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are allowed.');
    }

    // 2. Same-origin check (browsers send Origin on POST; curl does not — password still protects)
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    if (origin && origin !== url.origin) {
      return respond(403, 'FORBIDDEN_ORIGIN', 'Requests from other origins are not allowed.');
    }

    // 3. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return respond(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }

    // 4. Password
    if (!body || typeof body.password !== 'string' || body.password !== env.WRITE_PASSWORD) {
      return respond(401, 'UNAUTHORIZED', 'Incorrect password.');
    }

    // 5. Entries array
    if (!Array.isArray(body.entries)) {
      return respond(400, 'INVALID_ENTRIES', 'Field "entries" must be an array.');
    }

    // 6. Validate + normalise each entry
    const entries = {};
    for (let i = 0; i < body.entries.length; i++) {
      const e = body.entries[i];
      const n = i + 1;

      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        return respond(400, 'INVALID_ENTRY', `Entry #${n} must be an object.`);
      }

      const subject = typeof e.subject === 'string' ? e.subject.trim().toLowerCase() : '';
      if (!SUBJECTS.includes(subject)) {
        return respond(400, 'INVALID_SUBJECT',
          `Entry #${n}: "${e.subject}" is not a valid subject.`);
      }
      if (entries[subject]) {
        return respond(400, 'DUPLICATE_SUBJECT',
          `Entry #${n}: "${subject}" appears more than once.`);
      }

      // page is optional — empty string is allowed
      const page = (e.page ?? '').toString().trim();

      const description = typeof e.description === 'string' ? e.description.trim() : '';
      if (!description) {
        return respond(400, 'MISSING_DESCRIPTION',
          `Entry #${n} (${subject}): "description" is required.`);
      }

      const source = typeof e.source === 'string' ? e.source.trim().toLowerCase() : '';
      if (!SOURCES.includes(source)) {
        return respond(400, 'INVALID_SOURCE',
          `Entry #${n} (${subject}): "source" must be one of: ${SOURCES.join(', ')}.`);
      }

      const notes = typeof e.notes === 'string' ? e.notes.trim() : '';

      entries[subject] = { subject, page, description, source, notes };
    }

    // 7. Build payload
    const payload = {
      timestamp: new Date().toISOString(),
      entries
    };

    // 8. Backup current → write new
    const current = await env.HOMEWORK_KV.get('homework:current');
    if (current) {
      await env.HOMEWORK_KV.put('homework:backup', current);
    }
    await env.HOMEWORK_KV.put('homework:current', JSON.stringify(payload));

    return respond(200, 'SUCCESS', 'Homework updated successfully.', {
      timestamp: payload.timestamp,
      subjectsUpdated: Object.keys(entries).length
    });

  } catch (err) {
    return respond(500, 'SERVER_ERROR', 'Something went wrong on the server.');
  }
}
