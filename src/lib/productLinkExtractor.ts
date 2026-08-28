export interface ExtractedProductInfo {
  name?: string;
  price?: number;
  currency?: string;
  category?: string;
  image_url?: string;
  source_domain: string;
  description?: string;
  sku?: string;
  asin?: string;
}

/**
 * Extracts Amazon ASIN (10 alphanumeric characters) from an Amazon URL or string
 */
export function extractAmazonAsin(rawInput: string): string | null {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();

  // If it is directly a 10-char ASIN (e.g. B08N5WRWNW)
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const asinMatch = trimmed.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/d\/|\/exec\/obidos\/ASIN\/|[?&]asin=)([A-Z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      return asinMatch[1].toUpperCase();
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Generates an Amazon Multi-Item Remote Shopping Cart URL
 * Amazon AWS Remote Cart format:
 * https://www.amazon.{tld}/gp/aws/cart/add.html?ASIN.1=...&Quantity.1=...&ASIN.2=...&Quantity.2=...
 */
export function buildAmazonMultiCartUrl(
  items: { asin: string; quantity: number }[],
  domain: string = 'amazon.de'
): string {
  const validItems = items.filter(it => it.asin && it.asin.trim().length === 10 && it.quantity > 0);
  if (validItems.length === 0) return '';

  let cleanDomain = domain.toLowerCase().trim();
  if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
    try {
      cleanDomain = new URL(cleanDomain).hostname.replace(/^www\./, '');
    } catch {
      cleanDomain = 'amazon.de';
    }
  }
  if (!cleanDomain.includes('amazon.')) {
    cleanDomain = 'amazon.de';
  }

  const queryParts = validItems.map((item, idx) => {
    const pos = idx + 1;
    return `ASIN.${pos}=${encodeURIComponent(item.asin.toUpperCase())}&Quantity.${pos}=${Math.max(1, Math.round(item.quantity))}`;
  });

  return `https://www.${cleanDomain}/gp/aws/cart/add.html?${queryParts.join('&')}`;
}

/**
 * Generates Amazon Search URL for a product query
 */
export function buildAmazonSearchUrl(query: string, domain: string = 'amazon.de'): string {
  let cleanDomain = domain.toLowerCase().trim().replace(/^www\./, '');
  if (!cleanDomain.includes('amazon.')) cleanDomain = 'amazon.de';
  return `https://www.${cleanDomain}/s?k=${encodeURIComponent(query.trim())}`;
}

/**
 * Parses and extracts product metadata from links (e.g. Amazon, Otto, MediaMarkt, Digitec, Geizhals, etc.)
 */
export function extractProductFromUrl(rawUrl: string): ExtractedProductInfo | null {
  try {
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const parsed = new URL(cleanUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname;

    let info: ExtractedProductInfo = {
      source_domain: hostname,
      sku: `WEB-${Math.floor(1000 + Math.random() * 9000)}`
    };

    // 1. AMAZON (.de, .com, .at, .co.uk, etc.)
    if (hostname.includes('amazon.')) {
      // Look for /dp/ASIN or /gp/product/ASIN
      const asinMatch = pathname.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/d\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i);
      const asin = asinMatch ? asinMatch[1].toUpperCase() : null;

      // Extract title from slug /Product-Name/dp/ASIN
      const slugMatch = pathname.match(/^\/([^\/]+)\/dp\//i);
      let title = '';
      if (slugMatch && slugMatch[1]) {
        title = decodeURIComponent(slugMatch[1])
          .replace(/-/g, ' ')
          .replace(/\+/g, ' ')
          .trim();
      }

      info.source_domain = 'Amazon (' + hostname.split('.').pop()?.toUpperCase() + ')';
      info.name = title || (asin ? `Amazon Artikel (${asin})` : 'Amazon Produkt');
      info.sku = asin ? `AMZ-${asin}` : `AMZ-${Math.floor(1000 + Math.random() * 9000)}`;
      info.asin = asin || undefined;
      info.category = 'Handel & Elektronik';
      info.image_url = asin 
        ? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SX300_SCLZZZZZZZ_.jpg`
        : `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      
      // Amazon regional price approximation
      if (hostname.endsWith('.de') || hostname.endsWith('.at') || hostname.endsWith('.fr') || hostname.endsWith('.it') || hostname.endsWith('.es')) {
        info.currency = '€';
      } else if (hostname.endsWith('.com')) {
        info.currency = '$';
      } else if (hostname.endsWith('.co.uk')) {
        info.currency = '£';
      }

      return info;
    }

    // 2. OTTO (.de)
    if (hostname.includes('otto.de')) {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[0] || 'Artikel';
      const title = decodeURIComponent(slug).replace(/-/g, ' ');
      info.source_domain = 'OTTO';
      info.name = title;
      info.sku = `OTTO-${Math.floor(10000 + Math.random() * 90000)}`;
      info.category = 'Warenhaus / Versand';
      info.currency = '€';
      info.image_url = `https://www.google.com/s2/favicons?domain=otto.de&sz=128`;
      return info;
    }

    // 3. MEDIAMARKT / SATURN
    if (hostname.includes('mediamarkt.') || hostname.includes('saturn.')) {
      const parts = pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || 'Produkt';
      const title = decodeURIComponent(last).replace(/-/g, ' ').replace(/\.html$/i, '');
      info.source_domain = hostname.includes('mediamarkt') ? 'MediaMarkt' : 'Saturn';
      info.name = title;
      info.category = 'Elektronik & Technik';
      info.currency = '€';
      info.sku = `MM-${Math.floor(10000 + Math.random() * 90000)}`;
      info.image_url = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      return info;
    }

    // 4. DIGITEC / GALAXUS (.ch, .de)
    if (hostname.includes('digitec.ch') || hostname.includes('galaxus.')) {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] || 'Artikel';
      const title = decodeURIComponent(slug).replace(/-/g, ' ');
      info.source_domain = hostname.includes('digitec') ? 'Digitec Switzerland' : 'Galaxus';
      info.name = title;
      info.category = 'Technik & Bedarf';
      info.currency = hostname.endsWith('.ch') ? 'CHF' : '€';
      info.sku = `DG-${Math.floor(10000 + Math.random() * 90000)}`;
      info.image_url = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      return info;
    }

    // 5. GEIZHALS / IDEALO
    if (hostname.includes('geizhals.') || hostname.includes('idealo.')) {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] || 'Preisvergleich-Artikel';
      const title = decodeURIComponent(slug).replace(/-/g, ' ').replace(/\.html$/i, '');
      info.source_domain = hostname.includes('geizhals') ? 'Geizhals Preisvergleich' : 'Idealo';
      info.name = title;
      info.category = 'Preisvergleich Hardware';
      info.currency = '€';
      info.sku = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
      info.image_url = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      return info;
    }

    // 6. EBAY
    if (hostname.includes('ebay.')) {
      const itmMatch = pathname.match(/\/itm\/([0-9]+)/i);
      info.source_domain = 'eBay';
      info.name = itmMatch ? `eBay Artikel (#${itmMatch[1]})` : 'eBay Artikel';
      info.sku = itmMatch ? `EBAY-${itmMatch[1]}` : `EBAY-${Math.floor(1000 + Math.random() * 9000)}`;
      info.category = 'Online-Marktplatz';
      info.currency = '€';
      info.image_url = `https://www.google.com/s2/favicons?domain=ebay.de&sz=128`;
      return info;
    }

    // 7. GENERIC E-COMMERCE / WEBSITE LINK FALLBACK
    const pathParts = pathname.split('/').filter(Boolean);
    let derivedTitle = '';
    if (pathParts.length > 0) {
      const candidate = pathParts[pathParts.length - 1];
      derivedTitle = decodeURIComponent(candidate)
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|php|asp|jsp)$/i, '')
        .trim();
    }

    info.name = derivedTitle.length > 2 
      ? derivedTitle.charAt(0).toUpperCase() + derivedTitle.slice(1)
      : `Produkt von ${hostname}`;
    info.source_domain = hostname;
    info.image_url = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    info.category = 'Lieferant / Onlineshop';
    info.currency = '€';

    return info;
  } catch (err) {
    console.error('URL parsing failed:', err);
    return null;
  }
}
