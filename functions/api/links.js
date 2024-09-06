export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const links = await getLinks(env);
    return new Response(JSON.stringify(links), {
      headers: { 'Content-Type': 'application/json' },
    });
  } else if (request.method === 'POST') {
    const { password, link } = await request.json();
    
    // 验证密码
    if (password !== env.EDIT_PASSWORD) {
      return new Response('Unauthorized: Incorrect password', { status: 401 });
    }
    
    await saveLink(env, link);
    return new Response('Link saved', { status: 200 });
  }

  return new Response('Not found', { status: 404 });
}

async function getLinks(env) {
  const storedLinks = await env.LINKS_KV.get('all_links');
  return storedLinks ? JSON.parse(storedLinks) : getDefaultLinks();
}

async function saveLink(env, newLink) {
  const links = await getLinks(env);
  const index = links.findIndex(link => link.url === newLink.url);
  if (index > -1) {
    links[index] = newLink;
  } else {
    links.push(newLink);
  }
  await env.LINKS_KV.put('all_links', JSON.stringify(links));
}

function getDefaultLinks() {
  return [
    // Ai搜索
    { category: 'ai-search', title: 'Google', url: 'https://www.google.com', icon: 'fab fa-google' },
    { category: 'ai-search', title: 'Bing', url: 'https://www.bing.com', icon: 'fab fa-microsoft' },
    { category: 'ai-search', title: 'websim', url: 'https://websim.ai/', icon: 'fas fa-search' },
    { category: 'ai-search', title: 'chatgpt', url: 'https://chatgpt.com/', icon: 'fab fa-google' },
    { category: 'ai-search', title: '傻豆包', url: 'https://www.doubao.com/chat/', icon: 'fas fa-paw' },
    { category: 'ai-search', title: '傻元宝', url: 'https://yuanbao.tencent.com/', icon: 'fas fa-robot' },
    { category: 'ai-search', title: 'poe', url: 'https://poe.com/', icon: 'fas fa-robot' },
    { category: 'ai-search', title: 'claude', url: 'https://claude.ai/', icon: 'fas fa-robot' },
    { category: 'ai-search', title: 'ChandlerAi', url: 'https://chandler.bet/', icon: 'fas fa-robot' },
    { category: 'ai-search', title: 'mistral', url: 'https://mistral.ai/', icon: 'fas fa-brain' },
    { category: 'ai-search', title: '循证医学UTD', url: 'http://u.90tsg.com/', icon: 'fas fa-clinic-medical' },
    { category: 'ai-search', title: 'medscape', url: 'https://www.medscape.com/', icon: 'fas fa-stethoscope' },
    { category: 'ai-search', title: '免费oaichat', url: 'https://chat.oaichat.cc/', icon: 'fab fa-rocketchat' },
    { category: 'ai-search', title: 'leonardo.ai绘图', url: 'https://app.leonardo.ai/', icon: 'far fa-.leonardo.ai/', icon: 'far fa-images' },
    { category: 'ai-search', title: 'huggingface', url: 'https://huggingface.co/', icon: 'fas fa-meh-rolling-eyes' },
    { category: 'ai-search', title: 'lmarena', url: 'https://lmarena.ai/', icon: 'fas fa-robot' },
    { category: 'ai-search', title: 'kelaode', url: 'https://kelaode.ai/', icon: 'fas fa-robot' },

    // 社交媒体
    { category: 'social', title: 'Facebook', url: 'https://www.facebook.com', icon: 'fab fa-facebook' },
    { category: 'social', title: 'Twitter', url: 'https://twitter.com', icon: 'fab fa-twitter' },
    { category: 'social', title: 'Instagram', url: 'https://www.instagram.com', icon: 'fab fa-instagram' },
    { category: 'social', title: 'LinkedIn', url: 'https://www.linkedin.com', icon: 'fab fa-linkedin' },
    { category: 'social', title: 'TikTok', url: 'https://www.tiktok.com', icon: 'fab fa-tiktok' },
    { category: 'social', title: 'Reddit', url: 'https://www.reddit.com', icon: 'fab fa-reddit' },
    { category: 'social', title: 'GitHub', url: 'https://github.com/', icon: 'fab fa-github' },

    // 实用工具
    { category: 'tools', title: 'Google翻译', url: 'https://translate.google.com', icon: 'fas fa-language' },
    { category: 'tools', title: '短链', url: 'https://d.186404.xyz/', icon: 'fas fa-link' },
    { category: 'tools', title: 'dynv6', url: 'https://dynv6.com/', icon: 'fas fa-network-wired' },
    { category: 'tools', title: '网速测试', url: 'https://fast.com/', icon: 'fas fa-tachometer-alt' },
    { category: 'tools', title: 'Cloudns', url: 'https://www.cloudns.net/', icon: 'fas fa-cloud' },
    { category: 'tools', title: 'Cloudflare', url: 'https://www.cloudflare.com/zh-cn/', icon: 'fas fa-shield-alt' },
    { category: 'tools', title: '一个朋友', url: 'https://ygpy.net/', icon: 'fas fa-user-friends' },
    { category: 'tools', title: '谷歌笔记', url: 'https://notebooklm.google/', icon: 'fas fa-book' },
    { category: 'tools', title: '临时邮箱', url: 'https://email.ml/', icon: 'fas fa-envelope' },
    { category: 'tools', title: 'A姐', url: 'https://www.ahhhhfs.com/', icon: 'fas fa-blog' },
    { category: 'tools', title: 'IP查询', url: 'https://ip.sb/', icon: 'fas fa-map-marker-alt' },
    { category: 'tools', title: '图床', url: 'https://img.186404.xyz/', icon: 'fas fa-image' },
    { category: 'tools', title: 'Site域名转发', url: 'https://www.site.ac/', icon: 'fas fa-exchange-alt' },
    { category: 'tools', title: 'Z-Library', url: 'https://zh.go-to-library.sk/', icon: 'fas fa-book-reader' },
    { category: 'tools', title: 'us.kg域名', url: 'https://nic.us.kg/', icon: 'fas fa-globe' },
    { category: 'tools', title: 'Spaceship廉价域名', url: 'https://www.spaceship.com/zh/', icon: 'fas fa-space-shuttle' },
    { category: 'tools', title: 'HiN-VPN', url: 'https://itsyebekhe.github.io/HiN-VPN/', icon: 'fas fa-walking' },
    { category: 'tools', title: 'FontAwesome图标', url: 'https://fontawesome.com/', icon: 'fas fa-icons' },
    { category: 'tools', title: 'ip清洁度查询', url: 'https://scamalytics.com/', icon: 'fas fa-icons' },
    { category: 'tools', title: 'test-ipv6', url: 'https://test-ipv6.com/', icon: 'fas fa-ethernet' },
    { category: 'tools', title: 'zone/ip', url: 'https://html.zone/ip', icon: 'fab fa-sourcetree' },
    { category: 'tools', title: '免费网络代理', url: 'https://www.lumiproxy.com/zh-hans/online-proxy/proxysite/', icon: 'fas fa-unlock' },
    { category: 'tools', title: 'ipcheck', url: 'https://ipcheck.ing/', icon: 'fas fa-map-marker-alt' },
    { category: 'tools', title: '定时任务cron-job', url: 'https://console.cron-job.org/', icon: 'fas fa-ethernet' },
    { category: 'tools', title: 'uptimerobot', url: 'https://uptimerobot.com/', icon: 'fas fa-map-marker-alt' },
    { category: 'tools', title: 'forwardemail', url: 'https://forwardemail.net/', icon: 'fas fa-mail-bulk' },
    { category: 'tools', title: 'improvmx', url: 'https://improvmx.com/', icon: 'fas fa-mail-bulk' },

    // 科技资讯
    { category: 'tech-news', title: 'TechCrunch', url: 'https://www.techcrunch.com', icon: 'fas fa-newspaper' },
    { category: 'tech-news', title: 'Wired', url: 'https://www.wired.com', icon: 'fas fa-bolt' },
    { category: 'tech-news', title: 'The Verge', url: 'https://www.theverge.com', icon: 'fas fa-laptop' },
    { category: 'tech-news', title: 'Ars Technica', url: 'https://arstechnica.com', icon: 'fas fa-rocket' },
    { category: 'tech-news', title: 'Engadget', url: 'https://www.engadget.com', icon: 'fas fa-mobile-alt' },
    { category: 'tech-news', title: 'TechRadar', url: 'https://techradar.com', icon: 'fas fa-satellite' },
    { category: 'tech-news', title: '科技博客', url: 'https://b.186404.xyz/', icon: 'fas fa-blog' },
    { category: 'tech-news', title: 'cnbeta', url: 'https://www.cnbeta.com.tw/', icon: 'fas fa-info-circle' },

    // 云存储
    { category: 'cloud-storage', title: 'Dropbox', url: 'https://www.dropbox.com', icon: 'fas fa-cloud' },
    { category: 'cloud-storage', title: 'Google Drive', url: 'https://drive.google.com', icon: 'fab fa-google-drive' },
    { category: 'cloud-storage', title: 'OneDrive', url: 'https://onedrive.live.com', icon: 'fab fa-microsoft' },
    { category: 'cloud-storage', title: 'Box', url: 'https://www.box.com', icon: 'fas fa-box' },
    { category: 'cloud-storage', title: 'MediaFire', url: 'https://www.mediafire.com', icon: 'fas fa-file-alt' },
    { category: 'cloud-storage', title: 'MEGA', url: 'https://mega.nz', icon: 'fas fa-cloud-upload-alt' },

    // 电子邮箱
    { category: 'email', title: 'Gmail', url: 'https://mail.google.com', icon: 'fas fa-envelope' },
    { category: 'email', title: 'Outlook', url: 'https://outlook.live.com', icon: 'fab fa-microsoft' },
    { category: 'email', title: 'GMail临时邮箱', url: 'https://22.do/', icon: 'fas fa-envelope-open' },
    { category: 'email', title: '临时gMail', url: 'https://www.agogmail.com/', icon: 'fas fa-envelope-square' },
    { category: 'email', title: 'ProtonMail', url: 'https://www.protonmail.com', icon: 'fas fa-shield-alt' },
    { category: 'email', title: 'QQ邮箱', url: 'https://mail.qq.com', icon: 'fab fa-qq' },
    { category: 'email', title: '临时G邮箱', url: 'https://www.emailnator.com/', icon: 'fas fa-at' },
    { category: 'email', title: '临时谷歌邮箱', url: 'https://www.linshigmail.com/', icon: 'fas fa-mail-bulk' },
  ];
}
