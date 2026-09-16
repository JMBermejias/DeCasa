import ftp from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import path from 'node:path';
import { Readable } from 'node:stream';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function starsHtml(rating) {
  const full = Math.round(rating || 0);
  return `<span style="color:#f59e0b;font-size:13px">${'★'.repeat(full)}<span style="color:#cbd5e1">${'★'.repeat(Math.max(0, 5 - full))}</span></span>`;
}

function money(v, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(v || 0);
  } catch {
    return (v || 0).toFixed(2) + ' €';
  }
}

function generateStoreHtml(store, products, format) {
  const accent = format?.accent_color || store.accent_color || '#38bdf8';
  const title = format?.title || store.name;
  const showPrices = format?.show_prices !== false && store.show_prices !== 0;
  const showBadge = format?.show_badge;
  const perRow = format?.cards_per_row || 4;
  const minW = Math.max(190, 240 - perRow * 15);

  const productCards = products.map((p) => {
    const img = p.image_url
      ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" loading="lazy" />`
      : '';
    const badge = showBadge && p.reviews_count > 500
      ? '<span class="pub-badge">🥇 Mejor valorado</span>'
      : '';
    const price = showPrices && p.price
      ? `<div class="pub-price" style="color:${accent}">
           ${money(p.price)}
           ${p.original_price ? `<span class="pub-old-price">${money(p.original_price)}</span>` : ''}
         </div>`
      : '';
    return `
      <div class="pub-card">
        ${img}
        <div class="pub-card-body">
          <div class="pub-card-tags"><span class="pub-pill">${escHtml(p.category)}</span>${badge}</div>
          <h3>${escHtml(p.title)}</h3>
          <div class="pub-card-stars">
            ${starsHtml(p.rating)}
            <span class="pub-reviews">(${(p.reviews_count || 0).toLocaleString('es-ES')})</span>
          </div>
          ${price}
          <a class="pub-btn" style="background:${accent}" href="${escHtml(p.url || '#')}" target="_blank" rel="noreferrer noopener">Ver en Amazon →</a>
        </div>
      </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#0f2a3d;line-height:1.5;background:#f4f9fd}
.pub-header{background:linear-gradient(120deg,${accent},${accent}dd);color:#fff;padding:34px 20px;text-align:center}
.pub-header h1{margin:0 0 6px;font-size:28px}
.pub-header p{margin:0;opacity:.95}
.pub-content{max-width:1280px;margin:0 auto;padding:24px 20px 60px}
.pub-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:8px}
.pub-pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 12px;border-radius:999px;background:#dceefd;color:#1d7cb3;font-weight:600}
.pub-muted{color:#52718a;font-size:12px}
.pub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${minW}px,1fr));gap:18px}
.pub-card{background:#fff;border:1px solid #d9e8f4;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:all .2s ease}
.pub-card:hover{box-shadow:0 1px 3px rgba(13,71,110,.08),0 4px 14px rgba(13,71,110,.06);transform:translateY(-3px)}
.pub-card img{width:100%;height:200px;object-fit:cover;background:#eff8ff}
.pub-card-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}
.pub-card-tags{display:flex;gap:6px;align-items:center}
.pub-card-body h3{margin:0;font-size:14px;line-height:1.35;flex:1}
.pub-card-stars{display:flex;gap:8px;align-items:center}
.pub-reviews{color:#52718a;font-size:12px}
.pub-price{font-size:19px;font-weight:800}
.pub-old-price{font-size:13px;font-weight:500;color:#94a3b8;text-decoration:line-through;margin-left:8px}
.pub-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;background:#dcfce7;color:#166534}
.pub-btn{display:block;text-align:center;color:#fff;text-decoration:none;padding:11px;border-radius:10px;font-weight:700;transition:background .15s}
.pub-btn:hover{filter:brightness(.92)}
.pub-empty{text-align:center;padding:40px}
.pub-empty h3{margin-top:10px}
.pub-alert{background:#eff8ff;color:#1d7cb3;border:1px solid #b9defb;border-radius:10px;padding:12px 16px;font-size:13.5px;font-weight:500;margin-top:32px}
.pub-footer{text-align:center;padding:24px 20px 40px;color:#52718a;font-size:12px}
</style>
</head>
<body>
  <div class="pub-header">
    <h1>${escHtml(title)}</h1>
    ${format?.banner_text ? `<p>${escHtml(format.banner_text)}</p>` : ''}
    ${store.description ? `<p style="margin-top:6px;opacity:.9">${escHtml(store.description)}</p>` : ''}
  </div>
  <div class="pub-content">
    <div class="pub-row">
      <span class="pub-pill">🛍️ ${products.length} productos · Envíos y ventas gestionados por Amazon</span>
      <span class="pub-muted">Tienda creada con DeCasa</span>
    </div>
    ${products.length === 0 ? `
      <div class="pub-empty">
        <div style="font-size:36px">🛒</div>
        <h3>La tienda se está preparando</h3>
        <p class="pub-muted">El administrador está revisando productos para publicarlos. ¡Vuelve pronto!</p>
      </div>
    ` : `
      <div class="pub-grid">
        ${productCards}
      </div>
    `}
    <div class="pub-alert">
      🛡️ Esta tienda funciona mediante enlaces de afiliado de Amazon. Los pedidos, envíos y devoluciones los
      gestiona Amazon directamente; tú compras con total seguridad en la web oficial de Amazon.
    </div>
  </div>
  <div class="pub-footer">Publicado con DeCasa — Creador de tiendas online de afiliación Amazon</div>
</body>
</html>`;
}

export async function publishToFtp(config, store, products, format) {
  const remotePath = (config.remote_path || '').replace(/\/+$/, '');
  const remoteFile = remotePath ? `${remotePath}/index.html` : 'index.html';
  const html = generateStoreHtml(store, products, format);
  const buffer = Buffer.from(html, 'utf-8');
  const secure = config.secure === 'ftps' || config.secure === true;
  const isSftp = config.secure === 'sftp';
  const port = Number(config.port) || (isSftp ? 22 : secure ? 990 : 21);

  if (isSftp) return uploadSftp(config, port, remoteFile, buffer);

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.host,
      port,
      user: config.user,
      password: config.password,
      secure,
      secureOptions: { rejectUnauthorized: false }
    });

    if (remotePath) {
      await client.ensureDir(remotePath).catch(() => {});
    }

    await client.uploadFrom(Readable.from(buffer), path.basename(remoteFile));

    return {
      ok: true,
      message: `Tienda publicada en ${config.host}:${port} → ${remoteFile}`,
      url: config.public_url || `http://${config.host}/${remoteFile}`,
      file: remoteFile,
      size: buffer.length
    };
  } catch (err) {
    throw new Error(`Error FTP: ${err.message}`);
  } finally {
    client.close();
  }
}

async function uploadSftp(config, port, remoteFile, buffer) {
  const sftp = new SftpClient();
  try {
    await sftp.connect({ host: config.host, port, username: config.user, password: config.password });
    await sftp.mkdirAll?.(path.dirname(remoteFile)).catch(() => {});
    await sftp.put(buffer, remoteFile);
    await sftp.end();
    return {
      ok: true,
      message: `Tienda publicada (SFTP) en ${config.host}:${port} → ${remoteFile}`,
      url: config.public_url || `http://${config.host}/${remoteFile}`,
      file: remoteFile,
      size: buffer.length
    };
  } catch (err) {
    try { await sftp.end(); } catch {}
    throw new Error(`Error SFTP: ${err.message}`);
  }
}

export async function testFtpConnection(config) {
  const isSftp = config.secure === 'sftp';
  const port = Number(config.port) || (isSftp ? 22 : config.secure === 'ftps' || config.secure === true ? 990 : 21);

  if (isSftp) {
    const sftp = new SftpClient();
    try {
      await sftp.connect({ host: config.host, port, username: config.user, password: config.password });
      const pwd = await sftp.cwd();
      await sftp.end();
      return { ok: true, message: `Conexión SFTP exitosa. Directorio: ${pwd}` };
    } catch (err) {
      try { await sftp.end(); } catch {}
      throw new Error(`Error de conexión: ${err.message}`);
    }
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.host,
      port,
      user: config.user,
      password: config.password,
      secure: config.secure === 'ftps' || config.secure === true,
      secureOptions: { rejectUnauthorized: false }
    });
    const pwd = await client.pwd();
    return { ok: true, message: `Conexión exitosa. Directorio: ${pwd}` };
  } catch (err) {
    throw new Error(`Error de conexión: ${err.message}`);
  } finally {
    client.close();
  }
}

export { generateStoreHtml };
