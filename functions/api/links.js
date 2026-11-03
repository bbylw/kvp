const CATEGORIES = new Set([
  'ai-search',
  'social',
  'tools',
  'tech-news',
  'cloud-storage',
  'email',
]);

const STORAGE_KEY = 'all_links';
const DEFAULT_ICON = 'fa-solid fa-globe';
const ICON_PATTERN = /^(?:fas|far|fab|fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/;

const MAX_BODY_BYTES = 8 * 1024;
const MAX_LINKS = 500;
const MAX_TITLE_LENGTH = 60;
const MAX_URL_LENGTH = 2048;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method === 'GET') {
      return json(await getLinks(env));
    }

    if (request.method === 'POST') {
      return await handleSave(request, env);
    }

    if (request.method === 'DELETE') {
      return await handleDelete(request, env);
    }

    return json({ error: '不支持的请求方法' }, 405, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error('links API 错误:', error);
    return json({ error: '服务器内部错误，请稍后重试' }, 500);
  }
}

async function handleSave(request, env) {
  if (!env.LINKS_KV) {
    return json({ error: '服务端未绑定 LINKS_KV，无法保存修改' }, 500);
  }

  const { data, error } = await readJson(request);
  if (error) return error;

  const authError = await verifyPassword(data?.password, env);
  if (authError) return authError;

  const normalized = normalizeLink(data?.link);
  if (normalized.error) {
    return json({ error: normalized.error }, 400);
  }

  const links = await getLinks(env);
  const target = normalized.link.url;
  const originalUrl = data?.originalUrl ? normalizeUrl(data.originalUrl) : null;

  let index = originalUrl
    ? links.findIndex((item) => normalizeUrl(item.url) === originalUrl)
    : -1;

  if (index === -1) {
    index = links.findIndex((item) => normalizeUrl(item.url) === target);
  }

  if (index === -1 && links.length >= MAX_LINKS) {
    return json({ error: `链接数量已达上限（${MAX_LINKS} 条）` }, 400);
  }

  if (index === -1) {
    links.push(normalized.link);
  } else {
    const duplicate = links.findIndex(
      (item, itemIndex) => itemIndex !== index && normalizeUrl(item.url) === target,
    );

    if (duplicate !== -1) {
      links.splice(duplicate, 1);
    }

    const targetIndex = duplicate !== -1 && duplicate < index ? index - 1 : index;
    links[targetIndex] = normalized.link;
  }

  await putLinks(env, links);
  return json({ link: normalized.link, total: links.length });
}

async function handleDelete(request, env) {
  if (!env.LINKS_KV) {
    return json({ error: '服务端未绑定 LINKS_KV，无法保存修改' }, 500);
  }

  const { data, error } = await readJson(request);
  if (error) return error;

  const authError = await verifyPassword(data?.password, env);
  if (authError) return authError;

  const target = normalizeUrl(data?.url);
  if (!target) {
    return json({ error: '缺少要删除的链接地址' }, 400);
  }

  const links = await getLinks(env);
  const remaining = links.filter((item) => normalizeUrl(item.url) !== target);

  if (remaining.length === links.length) {
    return json({ error: '未找到该链接' }, 404);
  }

  await putLinks(env, remaining);
  return json({ total: remaining.length });
}

async function readJson(request) {
  let text;

  try {
    text = await request.text();
  } catch {
    return { error: json({ error: '无法读取请求内容' }, 400) };
  }

  if (text.length > MAX_BODY_BYTES) {
    return { error: json({ error: '请求内容过大' }, 413) };
  }

  try {
    return { data: text ? JSON.parse(text) : {} };
  } catch {
    return { error: json({ error: '请求格式不是有效的 JSON' }, 400) };
  }
}

async function verifyPassword(input, env) {
  if (!env.EDIT_PASSWORD) {
    return json({ error: '服务端未配置 EDIT_PASSWORD 环境变量' }, 500);
  }

  if (typeof input !== 'string' || input.length === 0 || input.length > 256) {
    return json({ error: '密码错误' }, 401);
  }

  if (!(await safeEqual(input, env.EDIT_PASSWORD))) {
    return json({ error: '密码错误' }, 401);
  }

  return null;
}

async function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);

  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let difference = 0;

  for (let i = 0; i < viewA.length; i += 1) {
    difference |= viewA[i] ^ viewB[i];
  }

  return difference === 0;
}

function normalizeLink(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: '缺少链接数据' };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    return { error: '标题不能为空' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符` };
  }

  const category = typeof input.category === 'string' ? input.category : '';
  if (!CATEGORIES.has(category)) {
    return { error: '分类不存在' };
  }

  const url = normalizeUrl(input.url);
  if (!url) {
    return { error: '网址必须是有效的 http 或 https 链接' };
  }

  let icon = DEFAULT_ICON;
  if (typeof input.icon === 'string' && input.icon.trim()) {
    icon = input.icon.trim();
    if (!ICON_PATTERN.test(icon)) {
      return { error: '图标格式不正确，请使用 Font Awesome 类名，例如 fa-solid fa-globe' };
    }
  }

  return { link: { category, title, url, icon } };
}

function normalizeUrl(value) {
  if (typeof value !== 'string') return null;

  let raw = value.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function getLinks(env) {
  if (!env.LINKS_KV) {
    return getDefaultLinks();
  }

  const stored = await env.LINKS_KV.get(STORAGE_KEY);
  if (!stored) {
    return getDefaultLinks();
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : getDefaultLinks();
  } catch {
    return getDefaultLinks();
  }
}

async function putLinks(env, links) {
  await env.LINKS_KV.put(STORAGE_KEY, JSON.stringify(links));
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function getDefaultLinks() {
  return [
    // Ai搜索
    { category: 'ai-search', title: '智谱清言', url: 'https://chatglm.cn/', icon: 'fa-solid fa-comment-dots' },
    { category: 'ai-search', title: 'mimo小米AI', url: 'https://mimo.xiaomi.com/', icon: 'fa-solid fa-mobile-retro' },
    { category: 'ai-search', title: 'openrouter', url: 'https://openrouter.ai/', icon: 'fa-brands fa-openid' },
    { category: 'ai-search', title: '千问国内版', url: 'https://www.qianwen.com/', icon: 'fa-solid fa-magnifying-glass' },
    { category: 'ai-search', title: 'chatgpt', url: 'https://chatgpt.com/', icon: 'fa-brands fa-google' },
    { category: 'ai-search', title: '豆包', url: 'https://www.doubao.com/chat/', icon: 'fa-solid fa-paw' },
    { category: 'ai-search', title: '扣子空间', url: 'https://space.coze.cn/', icon: 'fa-solid fa-shuttle-space' },
    { category: 'ai-search', title: '通义千问', url: 'https://chat.qwen.ai/', icon: 'fa-brands fa-rocketchat' },
    { category: 'ai-search', title: 'kimi', url: 'https://kimi.moonshot.cn/', icon: 'fa-regular fa-moon' },
    { category: 'ai-search', title: '文心一言', url: 'https://yiyan.baidu.com/', icon: 'fa-solid fa-dumpster-fire' },
    { category: 'ai-search', title: '腾讯混元', url: 'https://hunyuan.tencent.com/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'minimax', url: 'https://www.minimax.io/', icon: 'fa-solid fa-minimize' },
    { category: 'ai-search', title: 'z.ai', url: 'https://chat.z.ai/', icon: 'fa-solid fa-z' },
    { category: 'ai-search', title: 'google AIstudio', url: 'https://aistudio.google.com/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'gemini', url: 'https://gemini.google.com/', icon: 'fa-brands fa-google-plus' },
    { category: 'ai-search', title: 'labs.google', url: 'https://labs.google/', icon: 'fa-brands fa-google-plus' },
    { category: 'ai-search', title: 'jules.google', url: 'https://jules.google.com/', icon: 'fa-brands fa-google-plus' },
    { category: 'ai-search', title: 'stitch.withgoogle', url: 'https://stitch.withgoogle.com/', icon: 'fa-brands fa-square-google-plus' },
    { category: 'ai-search', title: 'copilot', url: 'https://copilot.microsoft.com/', icon: 'fa-brands fa-windows' },
    { category: 'ai-search', title: 'nvidia', url: 'https://build.nvidia.com/', icon: 'fa-solid fa-microchip' },
    { category: 'ai-search', title: '腾讯元宝', url: 'https://yuanbao.tencent.com/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'firecrawl', url: 'https://www.firecrawl.dev/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'mistral', url: 'https://mistral.ai/', icon: 'fa-solid fa-brain' },
    { category: 'ai-search', title: 'groq', url: 'https://groq.com/', icon: 'fa-solid fa-group-arrows-rotate' },
    { category: 'ai-search', title: 'skills', url: 'https://www.skills.sh/', icon: 'fa-solid fa-key' },
    { category: 'ai-search', title: 'ollama', url: 'https://ollama.com/', icon: 'fa-brands fa-rocketchat' },
    { category: 'ai-search', title: 'zenmux', url: 'https://zenmux.ai/', icon: 'fa-solid fa-mask' },
    { category: 'ai-search', title: 'chutes.ai', url: 'https://chutes.ai/', icon: 'fa-solid fa-chalkboard' },
    { category: 'ai-search', title: 'huggingface', url: 'https://huggingface.co/', icon: 'fa-solid fa-face-rolling-eyes' },
    { category: 'ai-search', title: 'lmarena', url: 'https://lmarena.ai/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'is-agentic', url: 'https://is-agentic.com/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'freeinference', url: 'https://freeinference.org/', icon: 'fa-brands fa-codepen' },
    { category: 'ai-search', title: 'grok', url: 'https://grok.com/', icon: 'fa-brands fa-x-twitter' },
    { category: 'ai-search', title: 'pce计算', url: 'https://ascvdpce.186404.xyz/', icon: 'fa-solid fa-heart-pulse' },
    { category: 'ai-search', title: 'letta-code', url: 'https://docs.letta.com/', icon: 'fa-solid fa-code' },
    { category: 'ai-search', title: 'v0', url: 'https://v0.dev/', icon: 'fa-solid fa-v' },
    { category: 'ai-search', title: 'cto.new', url: 'https://cto.new/', icon: 'fa-solid fa-v' },
    { category: 'ai-search', title: 'deepseek', url: 'https://www.deepseek.com/', icon: 'fa-brands fa-rocketchat' },
    { category: 'ai-search', title: '百小应医疗大模型', url: 'https://ying.baichuan-ai.com/', icon: 'fa-brands fa-rocketchat' },
    { category: 'ai-search', title: 'genspark.ai', url: 'https://www.genspark.ai/', icon: 'fa-brands fa-rocketchat' },
    { category: 'ai-search', title: 'firebase.google', url: 'https://firebase.google.com/', icon: 'fa-solid fa-code-branch' },
    { category: 'ai-search', title: 'Google Flow', url: 'https://flow.google.com/', icon: 'fa-brands fa-google-plus' },
    { category: 'ai-search', title: '404s.design', url: 'https://www.404s.design/', icon: 'fa-solid fa-code' },
    { category: 'ai-search', title: 'streamlake.ai', url: 'https://www.streamlake.ai/', icon: 'fa-solid fa-code' },
    { category: 'ai-search', title: 'codebuff', url: 'https://www.codebuff.com/', icon: 'fa-solid fa-robot' },
    { category: 'ai-search', title: 'ampcode', url: 'https://ampcode.com/', icon: 'fa-solid fa-code' },
    { category: 'ai-search', title: '硅基流动', url: 'https://siliconflow.cn/', icon: 'fa-brands fa-confluence' },
    { category: 'ai-search', title: '魔塔社区', url: 'https://www.modelscope.cn/', icon: 'fa-solid fa-code-branch' },
    { category: 'ai-search', title: '讯飞星辰MaaS', url: 'https://maas.xfyun.cn/', icon: 'fa-solid fa-bolt' },
    { category: 'ai-search', title: 'youmind', url: 'https://youmind.com/', icon: 'fa-solid fa-camera' },
    { category: 'ai-search', title: 'lovart', url: 'https://www.lovart.ai/zh/home', icon: 'fa-solid fa-file-image' },
    { category: 'ai-search', title: 'bolt.new', url: 'https://bolt.new/', icon: 'fa-solid fa-bolt' },
    { category: 'ai-search', title: 'Artificial Analysis', url: 'https://artificialanalysis.ai/', icon: 'fa-solid fa-chart-line' },
    { category: 'ai-search', title: 'perchai.app', url: 'https://www.perchai.app/', icon: 'fa-solid fa-crow' },

    // 托管社交
    { category: 'social', title: 'Facebook', url: 'https://www.facebook.com', icon: 'fa-brands fa-facebook' },
    { category: 'social', title: 'F-Droid', url: 'https://f-droid.org/', icon: 'fa-brands fa-android' },
    { category: 'social', title: '推特视频下载', url: 'https://twitterxz.com/', icon: 'fa-brands fa-x-twitter' },
    { category: 'social', title: 'Instagram', url: 'https://www.instagram.com', icon: 'fa-brands fa-instagram' },
    { category: 'social', title: 'render', url: 'https://render.com/', icon: 'fa-solid fa-draw-polygon' },
    { category: 'social', title: 'deno', url: 'https://deno.com/deploy', icon: 'fa-solid fa-d' },
    { category: 'social', title: 'railway', url: 'https://railway.com/', icon: 'fa-solid fa-archway' },
    { category: 'social', title: 'vercel', url: 'https://vercel.com/', icon: 'fa-solid fa-v' },
    { category: 'social', title: 'netlify', url: 'https://www.netlify.com/', icon: 'fa-brands fa-n' },
    { category: 'social', title: 'savefrom', url: 'https://zh.savefrom.net/', icon: 'fa-solid fa-share-from-square' },
    { category: 'social', title: 'apkmirror', url: 'https://www.apkmirror.com/', icon: 'fa-brands fa-android' },
    { category: 'social', title: 'Reddit', url: 'https://www.reddit.com', icon: 'fa-brands fa-reddit' },
    { category: 'social', title: '油管字幕下载', url: 'https://www.downloadyoutubesubtitles.com/', icon: 'fa-brands fa-youtube' },
    { category: 'social', title: 'GitHub', url: 'https://github.com/', icon: 'fa-brands fa-github' },
    { category: 'social', title: '油管视频下载', url: 'https://www.y2mate.com/', icon: 'fa-solid fa-download' },
    { category: 'social', title: '视频下载', url: 'https://youtube.iiilab.com/', icon: 'fa-solid fa-download' },
    { category: 'social', title: 'suno', url: 'https://suno.com/', icon: 'fa-solid fa-music' },
    { category: 'social', title: 'Appwrite', url: 'https://appwrite.io/', icon: 'fa-solid fa-server' },
    { category: 'social', title: 'Neon', url: 'https://neon.tech/', icon: 'fa-solid fa-database' },
    { category: 'social', title: 'Turso', url: 'https://turso.tech/', icon: 'fa-solid fa-database' },
    { category: 'social', title: '电影导航', url: 'https://movn.ndjp.net/', icon: 'fa-solid fa-tv' },
    { category: 'social', title: '追剧导航', url: 'https://zhuiju.ndjp.net/', icon: 'fa-solid fa-film' },

    // 实用工具
    { category: 'tools', title: 'MockAddress地址生成器', url: 'https://mockaddress.com/', icon: 'fa-solid fa-location-dot' },
    { category: 'tools', title: '短链', url: 'https://d.186404.xyz/', icon: 'fa-solid fa-link' },
    { category: 'tools', title: 'dynv6', url: 'https://dynv6.com/', icon: 'fa-solid fa-network-wired' },
    { category: 'tools', title: '网速测试', url: 'https://fast.com/', icon: 'fa-solid fa-gauge-high' },
    { category: 'tools', title: 'Cloudns', url: 'https://www.cloudns.net/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: 'Cloudflare', url: 'https://www.cloudflare.com/zh-cn/', icon: 'fa-solid fa-shield-halved' },
    { category: 'tools', title: '一个朋友', url: 'https://ygpy.net/', icon: 'fa-solid fa-user-group' },
    { category: 'tools', title: '谷歌笔记', url: 'https://notebooklm.google/', icon: 'fa-solid fa-book' },
    { category: 'tools', title: '临时邮箱', url: 'https://email.ml/', icon: 'fa-solid fa-envelope' },
    { category: 'tools', title: 'A姐', url: 'https://www.ahhhhfs.com/', icon: 'fa-solid fa-blog' },
    { category: 'tools', title: 'IP查询', url: 'https://ip.sb/', icon: 'fa-solid fa-location-dot' },
    { category: 'tools', title: 'dns.he域名托管', url: 'https://dns.he.net/', icon: 'fa-solid fa-network-wired' },
    { category: 'tools', title: 'Site域名转发', url: 'https://www.site.ac/', icon: 'fa-solid fa-right-left' },
    { category: 'tools', title: 'Z-Library', url: 'https://zh.go-to-library.sk/', icon: 'fa-solid fa-book-reader' },
    { category: 'tools', title: 'us.kg域名', url: 'https://domain.digitalplat.org/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'Spaceship廉价域名', url: 'https://www.spaceship.com/zh/', icon: 'fa-solid fa-rocket' },
    { category: 'tools', title: 'namecheap廉价域名', url: 'https://www.namecheap.com/', icon: 'fa-solid fa-rocket' },
    { category: 'tools', title: 'racknerd', url: 'https://www.racknerd.com/', icon: 'fa-solid fa-server' },
    { category: 'tools', title: 'FontAwesome图标', url: 'https://fontawesome.com/', icon: 'fa-solid fa-icons' },
    { category: 'tools', title: 'logosvg', url: 'https://worldvectorlogo.com/', icon: 'fa-regular fa-font-awesome' },
    { category: 'tools', title: 'ip清洁度查询', url: 'https://scamalytics.com/', icon: 'fa-solid fa-icons' },
    { category: 'tools', title: 'test-ipv6', url: 'https://test-ipv6.com/', icon: 'fa-solid fa-ethernet' },
    { category: 'tools', title: 'zone/ip', url: 'https://html.zone/ip', icon: 'fa-brands fa-sourcetree' },
    { category: 'tools', title: '免费网络代理', url: 'https://www.lumiproxy.com/zh-hans/online-proxy/proxysite/', icon: 'fa-solid fa-unlock' },
    { category: 'tools', title: 'ipcheck', url: 'https://ipcheck.ing/', icon: 'fa-solid fa-location-dot' },
    { category: 'tools', title: '定时任务cron-job', url: 'https://console.cron-job.org/', icon: 'fa-solid fa-ethernet' },
    { category: 'tools', title: 'uptimerobot', url: 'https://uptimerobot.com/', icon: 'fa-solid fa-location-dot' },
    { category: 'tools', title: 'forwardemail', url: 'https://forwardemail.net/', icon: 'fa-solid fa-envelopes-bulk' },
    { category: 'tools', title: 'improvmx', url: 'https://improvmx.com/', icon: 'fa-solid fa-envelopes-bulk' },
    { category: 'tools', title: 'github文件加速', url: 'https://gb.w404.nyc.mn/', icon: 'fa-brands fa-github' },
    { category: 'tools', title: 'hostryDNS域名托管', url: 'https://hostry.com/', icon: 'fa-solid fa-clock-rotate-left' },
    { category: 'tools', title: '免费域名sitelutions', url: 'https://www.sitelutions.com/', icon: 'fa-solid fa-sitemap' },
    { category: 'tools', title: '免费域名changeip', url: 'https://www.changeip.com/', icon: 'fa-solid fa-satellite-dish' },
    { category: 'tools', title: '免费域名dnsexit', url: 'https://dnsexit.com/', icon: 'fa-solid fa-users' },
    { category: 'tools', title: '免费域名gname', url: 'https://www.gname.com/', icon: 'fa-solid fa-users' },
    { category: 'tools', title: 'DNS查找nslookup', url: 'https://www.nslookup.io/', icon: 'fa-solid fa-arrows-rotate' },
    { category: 'tools', title: 'ping0', url: 'https://ping0.cc/', icon: 'fa-solid fa-fingerprint' },
    { category: 'tools', title: 'L53免费域名', url: 'https://customer.l53.net/', icon: 'fa-solid fa-fingerprint' },
    { category: 'tools', title: 'PDF在线工具', url: 'https://tools.pdf24.org/', icon: 'fa-solid fa-file-pdf' },
    { category: 'tools', title: 'free-proxy', url: 'http://free-proxy.cz/en/', icon: 'fa-brands fa-internet-explorer' },
    { category: 'tools', title: '在线代理croxyproxy', url: 'https://www.croxyproxy.rocks/_zh/', icon: 'fa-solid fa-unlock' },
    { category: 'tools', title: '微信Markdown编辑器', url: 'https://doocs.github.io/md/', icon: 'fa-regular fa-edit' },
    { category: 'tools', title: 'proxysite', url: 'https://www.proxysite.com/', icon: 'fa-solid fa-unlock' },
    { category: 'tools', title: 'serv00', url: 'https://www.serv00.com/', icon: 'fa-solid fa-server' },
    { category: 'tools', title: 'hostuno', url: 'https://www.hostuno.com/', icon: 'fa-solid fa-server' },
    { category: 'tools', title: 'PicGo', url: 'https://github.com/Molunerfinn/PicGo', icon: 'fa-solid fa-cloud-arrow-up' },
    { category: 'tools', title: 'SM.MS', url: 'https://smms.app/', icon: 'fa-solid fa-image' },
    { category: 'tools', title: 'FreeImageHost', url: 'https://freeimage.host/', icon: 'fa-solid fa-photo-film' },
    { category: 'tools', title: 'cobalt', url: 'https://cobalt.tools/', icon: 'fa-brands fa-youtube' },
    { category: 'tools', title: 'AI鉴定isthisai', url: 'https://isthisai.com/', icon: 'fa-solid fa-code' },
    { category: 'tools', title: 'tinywow', url: 'https://tinywow.com/', icon: 'fa-brands fa-free-code-camp' },
    { category: 'tools', title: '付费墙', url: 'https://paywallbuster.com/', icon: 'fa-solid fa-key' },
    { category: 'tools', title: 'PaywallHub', url: 'https://paywallhub.ndjp.net/', icon: 'fa-solid fa-unlock' },
    { category: 'tools', title: 'fmhy', url: 'https://fmhy.net/', icon: 'fa-regular fa-folder-open' },
    { category: 'tools', title: 'remove', url: 'https://www.remove.bg/', icon: 'fa-solid fa-image-portrait' },
    { category: 'tools', title: 'picwish', url: 'https://picwish.com/', icon: 'fa-regular fa-image' },
    { category: 'tools', title: '免费域名Stackryze', url: 'https://domain.stackryze.com/', icon: 'fa-solid fa-landmark-dome' },
    { category: 'tools', title: '免费域名HiDNS', url: 'https://www.hidoha.net/', icon: 'fa-solid fa-fingerprint' },
    { category: 'tools', title: 'pixabay', url: 'https://pixabay.com/', icon: 'fa-brands fa-pix' },
    { category: 'tools', title: 'InfinityFree', url: 'https://www.infinityfree.com/', icon: 'fa-solid fa-infinity' },
    { category: 'tools', title: 'anyvoice', url: 'https://anyvoice.net/', icon: 'fa-solid fa-microphone' },
    { category: 'tools', title: 'fish.audio', url: 'https://fish.audio/', icon: 'fa-solid fa-fish' },
    { category: 'tools', title: 'noizai', url: 'https://noiz.ai/', icon: 'fa-solid fa-circle-notch' },
    { category: 'tools', title: 'Design Radar设计灵感导航', url: 'https://design.ndjp.net/', icon: 'fa-solid fa-file-audio' },
    { category: 'tools', title: 'desec免费域名', url: 'https://desec.io/', icon: 'fa-solid fa-anchor' },
    { category: 'tools', title: 'lovable网站生成', url: 'https://lovable.dev/', icon: 'fa-solid fa-shield-heart' },
    { category: 'tools', title: 'ndjp免费域名', url: 'https://ndjp.net/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'dynu免费域名', url: 'https://www.dynu.com/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'zone免费域名', url: 'https://zone.id/', icon: 'fa-solid fa-id-card-clip' },
    { category: 'tools', title: 'dnshe免费域名', url: 'https://my.dnshe.com/', icon: 'fa-solid fa-id-card-clip' },
    { category: 'tools', title: 'x10hosting免费托管', url: 'https://x10hosting.com/', icon: 'fa-solid fa-ghost' },
    { category: 'tools', title: 'nodeloc社区', url: 'https://www.nodeloc.com/', icon: 'fa-brands fa-hashnode' },
    { category: 'tools', title: 'same复制网站', url: 'https://same.new/', icon: 'fa-solid fa-copy' },
    { category: 'tools', title: 'claw容器', url: 'https://claw.cloud/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: '免费域名zoneabc', url: 'https://zoneabc.net/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: '免费域名gv.uy', url: 'https://nic.gv.uy/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: '免费域名isroot', url: 'https://isroot.in/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: 'subeasy字幕', url: 'https://www.subeasy.ai/zh-CN', icon: 'fa-solid fa-closed-captioning' },
    { category: 'tools', title: '知识卡片', url: 'https://cardify.godsbee.com/', icon: 'fa-solid fa-credit-card' },
    { category: 'tools', title: 'webhostmost网站托管', url: 'https://www.webhostmost.com/', icon: 'fa-solid fa-web-awesome' },
    { category: 'tools', title: 'edgeone', url: 'https://edgeone.ai/', icon: 'fa-brands fa-edge' },
    { category: 'tools', title: 'cyberpanel免费VPN', url: 'https://cyberpanel.net/', icon: 'fa-solid fa-graduation-cap' },
    { category: 'tools', title: 'Stormkit', url: 'https://www.stormkit.io/', icon: 'fa-solid fa-cloud' },
    { category: 'tools', title: '1984免费DNS托管', url: 'https://1984.hosting/', icon: 'fa-solid fa-network-wired' },
    { category: 'tools', title: 'int.yt免费域名', url: 'https://dash.int.yt/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'nssnap免费域名', url: 'https://nssnap.com/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'devs.surf 免费域名', url: 'https://devs.surf/', icon: 'fa-solid fa-water' },
    { category: 'tools', title: 'Zerexa Domains 免费域名', url: 'https://nic.fj.kg/', icon: 'fa-solid fa-globe' },
    { category: 'tools', title: 'PinMe', url: 'https://pinme.eth.limo/', icon: 'fa-solid fa-thumbtack' },
    { category: 'tools', title: 'Openverse', url: 'https://openverse.org/', icon: 'fa-brands fa-creative-commons' },

    // 科技资讯
    { category: 'tech-news', title: 'TechCrunch', url: 'https://www.techcrunch.com', icon: 'fa-solid fa-newspaper' },
    { category: 'tech-news', title: 'Wired', url: 'https://www.wired.com', icon: 'fa-solid fa-bolt' },
    { category: 'tech-news', title: 'The Verge', url: 'https://www.theverge.com', icon: 'fa-solid fa-laptop' },
    { category: 'tech-news', title: 'Ars Technica', url: 'https://arstechnica.com', icon: 'fa-solid fa-rocket' },
    { category: 'tech-news', title: 'Engadget', url: 'https://www.engadget.com', icon: 'fa-solid fa-mobile-screen' },
    { category: 'tech-news', title: '科技日报', url: 'https://scitechdaily.com/', icon: 'fa-solid fa-microscope' },
    { category: 'tech-news', title: 'TechRadar', url: 'https://techradar.com', icon: 'fa-solid fa-satellite' },
    { category: 'tech-news', title: '精彩的开源项目', url: 'https://www.opensourceprojects.dev/', icon: 'fa-regular fa-folder-open' },
    { category: 'tech-news', title: 'cnbeta', url: 'https://www.cnbeta.com.tw/', icon: 'fa-solid fa-circle-info' },

    // 云存储
    { category: 'cloud-storage', title: 'Dropbox', url: 'https://www.dropbox.com', icon: 'fa-brands fa-dropbox' },
    { category: 'cloud-storage', title: 'Google Drive', url: 'https://drive.google.com', icon: 'fa-brands fa-google-drive' },
    { category: 'cloud-storage', title: 'OneDrive', url: 'https://onedrive.live.com', icon: 'fa-brands fa-microsoft' },
    { category: 'cloud-storage', title: 'Box', url: 'https://www.box.com', icon: 'fa-solid fa-box' },
    { category: 'cloud-storage', title: 'MediaFire', url: 'https://www.mediafire.com', icon: 'fa-solid fa-file' },
    { category: 'cloud-storage', title: 'MEGA', url: 'https://mega.nz', icon: 'fa-solid fa-cloud-arrow-up' },
    { category: 'cloud-storage', title: 'PikPak', url: 'https://mypikpak.com/', icon: 'fa-solid fa-cloud' },

    // 电子邮箱
    { category: 'email', title: 'Zoho Mail企业邮箱', url: 'https://www.zoho.com/mail/', icon: 'fa-solid fa-envelope' },
    { category: 'email', title: 'Outlook', url: 'https://outlook.live.com', icon: 'fa-brands fa-microsoft' },
    { category: 'email', title: 'cock邮箱', url: 'https://cock.li/', icon: 'fa-solid fa-envelope-open' },
    { category: 'email', title: 'disroot邮箱', url: 'https://disroot.org/', icon: 'fa-solid fa-envelope-circle-check' },
    { category: 'email', title: 'ProtonMail', url: 'https://www.protonmail.com', icon: 'fa-solid fa-shield-halved' },
    { category: 'email', title: 'tinkmail企业邮箱', url: 'https://tinkmail.me/', icon: 'fa-brands fa-qq' },
    { category: 'email', title: 'Cloudflare临时邮件', url: 'https://em.bjedu.tech/', icon: 'fa-solid fa-at' },
    { category: 'email', title: '临时教育邮箱', url: 'https://edumail.su/', icon: 'fa-solid fa-envelopes-bulk' },
  ];
}
