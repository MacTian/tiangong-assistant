// cloudfunctions/syncNotes/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DEEPSEEK_EMBED_URL = 'https://api.deepseek.com/v1/embeddings';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function getValidToken() {
  const record = await db.collection('ms_graph_token')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (record.data.length === 0) throw new Error('未授权 OneNote');

  const token = record.data[0];

  if (new Date(token.expiresAt) < new Date(Date.now() + 5 * 60000)) {
    return await refreshToken(token.refreshToken);
  }

  return token.accessToken;
}

async function refreshToken(refreshTokenValue) {
  const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(process.env.AZURE_CLIENT_ID || '')}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshTokenValue)}&scope=${encodeURIComponent('https://graph.microsoft.com/Notes.Read offline_access')}`
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Token 刷新失败');

  await db.collection('ms_graph_token').add({
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshTokenValue,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      createdAt: new Date()
    }
  });

  return data.access_token;
}

async function graphRequest(path, token) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph API ${res.status}: ${errText}`);
  }
  return res.json();
}

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>/gi, '\n# ')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<h3[^>]*>/gi, '\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2: $1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length <= chunkSize) return text ? [text] : [];

  const chunks = [];
  const sections = text.split(/^#{1,3}\s+/m).filter(s => s.trim());

  for (const section of sections) {
    if (section.length <= chunkSize) {
      if (section.length >= 50) chunks.push(section.trim());
      continue;
    }
    let start = 0;
    while (start < section.length) {
      const end = Math.min(start + chunkSize, section.length);
      const chunk = section.slice(start, end).trim();
      if (chunk.length >= 50) chunks.push(chunk);
      start += chunkSize - overlap;
    }
  }

  return chunks;
}

async function getEmbedding(text) {
  const res = await fetch(DEEPSEEK_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function upsertChunks(chunks, meta) {
  const rows = [];
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    rows.push({
      content: chunk,
      embedding,
      notebook: meta.notebook,
      section: meta.section,
      page_title: meta.pageTitle,
      page_id: meta.pageId,
      page_url: meta.pageUrl,
      modified_at: meta.modifiedAt
    });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/note_chunks?page_id=eq.${meta.pageId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/note_chunks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Supabase insert error:', errText);
  }

  return rows.length;
}

exports.main = async (event, context) => {
  const startTime = Date.now();
  let added = 0, updated = 0, errors = 0;

  try {
    const token = await getValidToken();

    const notebooksData = await graphRequest('/me/onenote/notebooks', token);
    const notebooks = notebooksData.value || [];

    for (const notebook of notebooks) {
      const sectionsData = await graphRequest(
        `/me/onenote/notebooks/${notebook.id}/sections`, token
      );
      const sections = sectionsData.value || [];

      for (const section of sections) {
        const pagesData = await graphRequest(
          `/me/onenote/sections/${section.id}/pages?$select=id,title,lastModifiedDateTime,createdDateTime`, token
        );
        const pages = pagesData.value || [];

        for (const page of pages) {
          try {
            const pageContent = await graphRequest(
              `/me/onenote/pages/${page.id}/content?includeIDs=true`, token
            );

            const textContent = htmlToText(pageContent.body?.content || '');
            if (!textContent || textContent.length < 20) continue;

            const chunks = splitIntoChunks(textContent);
            if (chunks.length === 0) continue;

            const stored = await upsertChunks(chunks, {
              notebook: notebook.displayName || '未命名笔记本',
              section: section.displayName || '未命名分区',
              pageTitle: page.title || '无标题',
              pageId: page.id,
              pageUrl: page.links?.oneNoteWebUrl?.href || '',
              modifiedAt: page.lastModifiedDateTime
            });

            if (stored > 0) added++;

            await db.collection('note_metadata').doc(page.id).set({
              data: {
                page_id: page.id,
                notebook: notebook.displayName || '',
                section: section.displayName || '',
                title: page.title || '',
                text_content: textContent.substring(0, 50000),
                modified_at: page.lastModifiedDateTime,
                synced_at: new Date()
              }
            });

          } catch (pageErr) {
            console.error(`Page ${page.id} sync error:`, pageErr.message);
            errors++;
          }
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    await db.collection('sync_logs').add({
      data: {
        syncTime: new Date(),
        type: 'incremental',
        added,
        updated,
        deleted: 0,
        errors,
        duration,
        status: errors > 0 ? 'partial' : 'success'
      }
    });

    return {
      code: 0,
      data: { added, updated, errors, duration },
      message: `同步完成：新增 ${added} 篇，${errors > 0 ? errors + ' 篇出错' : '全部成功'}`
    };

  } catch (err) {
    console.error('syncNotes error:', err);
    return { code: 500, message: `同步失败：${err.message}` };
  }
};
