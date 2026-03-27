const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Preview-Secret',
};

function getFallbackHtml(slug) {
  return '<!DOCTYPE html><html><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<title>Sorted — Post Review</title>' +
    '<meta http-equiv="refresh" content="0; url=https://guneygaar.github.io/ok/index.html?p=' + slug + '" />' +
    '<meta property="og:title" content="Review this post on Sorted">' +
    '<meta property="og:description" content="Tap to open and approve this post.">' +
    '</head><body>Opening Sorted...</body></html>';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' &&
        url.pathname === '/store-preview') {
      const secret = request.headers.get('X-Preview-Secret');
      if (!secret || secret !== env.PREVIEW_SECRET) {
        return new Response('Unauthorized', {
          status: 401,
          headers: CORS_HEADERS
        });
      }
      try {
        const body = await request.json();
        const slug = body.slug;
        const html = body.html;
        if (!slug || !html) {
          return new Response('Missing slug or html', {
            status: 400,
            headers: CORS_HEADERS
          });
        }
        await env.PREVIEWS_KV.put(
          slug, html, { expirationTtl: 2592000 }
        );
        return new Response(
          JSON.stringify({ success: true, slug: slug }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      } catch (err) {
        return new Response('Bad Request', {
          status: 400,
          headers: CORS_HEADERS
        });
      }
    }

    if (request.method === 'GET' &&
        (url.pathname.startsWith('/ok') ||
         url.pathname.startsWith('/no'))) {
      const slug = url.searchParams.get('p') || '';
      if (!slug) {
        return new Response(getFallbackHtml(''), {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            ...CORS_HEADERS
          }
        });
      }
      const cachedHtml = await env.PREVIEWS_KV.get(slug);
      if (cachedHtml) {
        return new Response(cachedHtml, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            ...CORS_HEADERS
          }
        });
      }
      return new Response(getFallbackHtml(slug), {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          ...CORS_HEADERS
        }
      });
    }

    return new Response('Not Found', {
      status: 404,
      headers: CORS_HEADERS
    });
  }
};
