export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://srtd.io',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const secret = request.headers.get('X-Upload-Secret');
    if (secret !== 'srtd2026xK9mN3pQ') {
      return new Response('Unauthorized', { status: 401 });
    }
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    if (!filename) {
      return new Response('Missing filename', { status: 400 });
    }
    const body = await request.arrayBuffer();
    const contentType = request.headers.get('Content-Type')
      || 'image/jpeg';
    await env.SORTED_IMAGES.put(filename, body, {
      httpMetadata: { contentType }
    });
    const publicUrl =
      'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/'
      + filename;
    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://srtd.io',
      }
    });
  }
};
