const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function respond(status, code, message, data) {
  const body = { code, message };
  if (data !== undefined) body.data = data;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle browser preflight (only sent when custom headers are used)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (request.method !== 'GET') {
      return respond(405, 'METHOD_NOT_ALLOWED', 'Only GET requests are allowed.');
    }

    const raw = await env.HOMEWORK_KV.get('homework:current');

    if (!raw) {
      return respond(200, 'NO_HOMEWORK', 'No homework has been posted yet.', {
        timestamp: null,
        entries: {}
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return respond(500, 'SERVER_ERROR', 'Stored homework data is corrupted.');
    }

    return respond(200, 'SUCCESS', 'Homework fetched successfully.', parsed);

  } catch (err) {
    return respond(500, 'SERVER_ERROR', 'Something went wrong on the server.');
  }
}
