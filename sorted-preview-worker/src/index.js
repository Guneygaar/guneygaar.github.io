const SUPABASE_URL = 'https://vxokfscjzytpgdrmertk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2tmc2Nqenl0cGdkcm1lcnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzE2NzAsImV4cCI6MjA4ODkwNzY3MH0.j1LKb2FOarLIi5DDChiWF_DTihKdLCEQMKdy9M5JQkw';

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

function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function findPostByShortId(shortId) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/posts?select=post_id,title,caption,images',
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    }
  );
  if (!res.ok) return null;
  const posts = await res.json();
  if (!Array.isArray(posts)) return null;
  for (let i = 0; i < posts.length; i++) {
    const pid = (posts[i].post_id || posts[i].id || '');
    const digits = pid.replace(/[^0-9]/g, '').slice(-4);
    if (digits === shortId) return posts[i];
  }
  return null;
}

async function handlePreview(url) {
  const shortId = url.searchParams.get('p') || '';
  if (!shortId) return fetch(url.toString());

  const post = await findPostByShortId(shortId);
  if (!post) return fetch(url.toString());

  const title = escAttr(post.title || 'Review Post');
  const imgUrl = (Array.isArray(post.images) && post.images.length)
    ? escAttr(post.images[0]) : '';

  const ogTags = '\n' +
    '<meta property="og:title" content="' + title + '">\n' +
    '<meta property="og:description" content="Awaiting your approval - Sorted by Hinglish Agency">\n' +
    '<meta property="og:image" content="' + imgUrl + '">\n' +
    '<meta property="og:image:width" content="1200">\n' +
    '<meta property="og:image:height" content="630">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:url" content="https://srtd.io/p/' + escAttr(shortId) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:image" content="' + imgUrl + '">';

  const originRes = await fetch(
    'https://guneygaar.github.io/preview/index.html?p=' + shortId
  );
  let html = await originRes.text();
  html = html.replace('<head>', '<head>' + ogTags);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      ...CORS_HEADERS
    }
  });
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
        url.pathname.startsWith('/preview')) {
      return handlePreview(url);
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
