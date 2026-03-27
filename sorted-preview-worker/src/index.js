const SUPABASE_URL = 'https://vxokfscjzytpgdrmertk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2tmc2Nqenl0cGdkcm1lcnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzE2NzAsImV4cCI6MjA4ODkwNzY3MH0.j1LKb2FOarLIi5DDChiWF_DTihKdLCEQMKdy9M5JQkw';

async function getPost(slug) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/posts?select=post_id,title,caption,images&title=ilike.*' +
    slug.replace(/-/g, '%20') + '*&limit=5',
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  );
  const data = await res.json();
  if (!data || !data.length) return null;
  for (const post of data) {
    const testSlug = post.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
    if (testSlug === slug) return post;
  }
  return data[0];
}

async function injectMeta(pageUrl, slug) {
  const post = await getPost(slug);
  const rawImgUrl = post && Array.isArray(post.images) && post.images.length
    ? post.images[0] : '';
  const imgUrl = rawImgUrl;
  const title = post ? post.title : 'Review Post';
  const caption = post ? (post.caption || '').slice(0, 150) : '';
  const res = await fetch(pageUrl);
  let html = await res.text();
  const meta = `
<meta property="og:image" content="${imgUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${caption}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://srtd.io/ok/?p=${slug}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${imgUrl}">`;
  html = html.replace('<head>', '<head>\n' + meta);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const slug = url.searchParams.get('p') || '';
    if (url.pathname.startsWith('/ok')) {
      return injectMeta('https://guneygaar.github.io/ok/index.html', slug);
    }
    if (url.pathname.startsWith('/no')) {
      return injectMeta('https://guneygaar.github.io/no/index.html', slug);
    }
    return fetch(request);
  }
};
