import crypto from 'crypto';
import { getSetting } from '../db.js';

const MARKETPLACES = {
  'amazon.es': { host: 'webservices.amazon.es', region: 'eu-west-1' },
  'amazon.com': { host: 'webservices.amazon.com', region: 'us-east-1' },
  'amazon.co.uk': { host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  'amazon.de': { host: 'webservices.amazon.de', region: 'eu-west-1' },
  'amazon.fr': { host: 'webservices.amazon.fr', region: 'eu-west-1' },
  'amazon.it': { host: 'webservices.amazon.it', region: 'eu-west-1' },
  'amazon.ca': { host: 'webservices.amazon.ca', region: 'us-east-1' },
  'amazon.com.mx': { host: 'webservices.amazon.com.mx', region: 'us-east-1' },
  'amazon.com.br': { host: 'webservices.amazon.com.br', region: 'us-east-1' }
};

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sign(secretKey, date, region, service, stringToSign) {
  const kDate = hmac('AWS4' + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
}

function signRequest({ accessKey, secretKey, host, region, path, payload }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  const canonicalRequest = [
    'POST',
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
  ].join('\n');
  const signature = sign(secretKey, dateStamp, region, 'ProductAdvertisingAPI', stringToSign);
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'X-Amz-Date': amzDate,
    'x-amz-content-sha256': payloadHash
  };
}

function formatPrice(displayAmount, currency) {
  return { amount: displayAmount, currency: currency || 'EUR' };
}

async function searchPaApi(settings, keywords, category) {
  const mp = MARKETPLACES[settings.marketplace] || MARKETPLACES['amazon.es'];
  const host = mp.host;
  const region = mp.region;
  const path = '/paapi5/searchitems';
  const resources = [
    'ItemInfo.Title',
    'ItemInfo.ByLineInfo',
    'ItemInfo.Features',
    'Offers.Listings.Price',
    'Images.Primary.Large',
    'BrowseNodeInfo.BrowseNodes',
    'BrowseNodeInfo.Category'
  ];
  const payload = JSON.stringify({
    PartnerType: 'Associates',
    PartnerTag: settings.partner_tag,
    Marketplace: settings.marketplace,
    Keywords: keywords,
    SearchIndex: category && category !== 'Todos' ? category : undefined,
    ItemCount: 20,
    Resources: resources
  });
  const headers = signRequest({
    accessKey: settings.access_key,
    secretKey: settings.secret_key,
    host,
    region,
    path,
    payload
  });
  const res = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...headers
    },
    body: payload
  });
  const data = await res.json();
  if (data.Errors) {
    throw new Error(data.Errors.map((e) => e.Message).join('; '));
  }
  const items = (data.SearchResult && data.SearchResult.Items) || [];
  return items.map((item) => {
    const title = item.ItemInfo?.Title?.DisplayValue || 'Sin título';
    const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount;
    const parsedPrice = price ? parseFloat(String(price).replace(/[^\d.,]/g, '').replace(',', '.')) : null;
    const r = item.ItemInfo?.ByLineInfo;
    return {
      asin: item.ASIN,
      title,
      price: parsedPrice,
      original_price: null,
      rating: 0,
      reviews_count: 0,
      image_url: item.Images?.Primary?.Large?.URL || '',
      url: `https://${settings.marketplace}/dp/${item.ASIN}?tag=${settings.partner_tag}`,
      category: item.BrowseNodeInfo?.Category || category || 'General',
      description: item.ItemInfo?.Features?.DisplayValues?.[0] || ''
    };
  });
}

function generateAsin() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const DEMO_TEMPLATES = [
  { base: '{q} de alta calidad profesional', cat: 'Hogar y cocina' },
  { base: '{q} edición 2026 mejorada', cat: 'Electrónica' },
  { base: '{q} con valoraciones excelentes', cat: 'Deportes y aire libre' },
  { base: '{q} ecológico y resistente', cat: 'Hogar y cocina' },
  { base: '{q} versión premium', cat: 'Electrónica' },
  { base: '{q} multiusos', cat: 'Jardín' },
  { base: '{q} diseño ergonómico', cat: 'Belleza' },
  { base: '{q} con garantía de 2 años', cat: 'Hogar y cocina' },
  { base: '{q} color clásico', cat: 'Moda' },
  { base: '{q} superventas nº 1', cat: 'General' },
  { base: '{q} para profesionales', cat: 'Oficina y papelería' },
  { base: '{q} juego de regalo', cat: 'Juguetes' }
];

const DEMO_IMAGES = [
  'https://picsum.photos/seed/p1/400/400',
  'https://picsum.photos/seed/p2/400/400',
  'https://picsum.photos/seed/p3/400/400',
  'https://picsum.photos/seed/p4/400/400',
  'https://picsum.photos/seed/p5/400/400',
  'https://picsum.photos/seed/p6/400/400',
  'https://picsum.photos/seed/p7/400/400',
  'https://picsum.photos/seed/p8/400/400'
];

function searchDemo(keywords) {
  const settings = getSetting('amazon', {});
  const tag = settings.partner_tag || 'decasa-21';
  const q = keywords || 'producto';
  return DEMO_TEMPLATES.map((tpl, i) => {
    const rating = +(3.7 + Math.random() * 1.3).toFixed(1);
    const reviews = Math.floor(50 + Math.random() * 4500);
    const price = +(5 + Math.random() * 95).toFixed(2);
    const discount = Math.random() > 0.4;
    const original = discount ? +(price * (1.15 + Math.random() * 0.4)).toFixed(2) : null;
    return {
      asin: generateAsin(),
      title: tpl.base.replace('{q}', q.charAt(0).toUpperCase() + q.slice(1)) + ' - ' + tpl.cat,
      price,
      original_price: original,
      rating,
      reviews_count: reviews,
      image_url: DEMO_IMAGES[i % DEMO_IMAGES.length],
      url: `https://${settings.marketplace}/dp/${generateAsin()}?tag=${tag}`,
      category: tpl.cat,
      description: 'Producto de demostración con reseñas excelentes. Sustituye esta imagen y URL cuando configures tus claves reales de la API de Amazon.'
    };
  });
}

export async function searchAmazonProducts(keywords, category) {
  const settings = getSetting('amazon', {});
  const demo = settings.demo_mode !== false && !settings.access_key;
  if (demo || !settings.access_key || !settings.secret_key || !settings.partner_tag) {
    return { products: searchDemo(keywords), demo: true };
  }
  try {
    const products = await searchPaApi(settings, keywords, category);
    return { products, demo: false };
  } catch (err) {
    if (settings.demo_mode) {
      return { products: searchDemo(keywords), demo: true, warning: err.message };
    }
    throw err;
  }
}
