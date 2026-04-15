const SOURCES = [
    {
        source: 'Ministry of Education - Ghana',
        siteUrl: 'https://moe.gov.gh/',
        fallbackNewsUrl: 'https://moe.gov.gh/news/',
        preferredLinkPatterns: ['/news/', '/press', '/update', '/announcement'],
        feedUrls: ['https://moe.gov.gh/feed/']
    },
    {
        source: 'Ghana Education Service',
        siteUrl: 'https://ges.gov.gh/',
        fallbackNewsUrl: 'https://ges.gov.gh/category/news/',
        preferredLinkPatterns: ['/news/', '/category/news', '/announcement', '/press'],
        feedUrls: ['https://ges.gov.gh/feed/']
    },
    {
        source: 'WAEC Ghana',
        siteUrl: 'https://waecgh.org/',
        fallbackNewsUrl: 'https://waecgh.org/',
        preferredLinkPatterns: ['/news', '/announcement', '/public', '/notice'],
        feedUrls: ['https://waecgh.org/feed/']
    },
    {
        source: 'Oxford International Curriculum',
        siteUrl: 'https://www.oxfordinternationalcurriculum.com/',
        fallbackNewsUrl: 'https://www.oxfordinternationalcurriculum.com/news/',
        preferredLinkPatterns: ['/news/', '/blog/', '/article/', '/updates/'],
        feedUrls: ['https://www.oxfordinternationalcurriculum.com/news/feed/']
    }
];

function decodeHtml(text) {
    if (!text) {
        return '';
    }

    return text
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function firstMatch(text, pattern) {
    const match = text.match(pattern);
    return match ? decodeHtml(match[1]) : '';
}

function extractRssItems(xml) {
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

    return blocks
        .map(function (itemBlock) {
            const title = firstMatch(itemBlock, /<title>([\s\S]*?)<\/title>/i);
            const link = firstMatch(itemBlock, /<link>([\s\S]*?)<\/link>/i);
            const pubDate = firstMatch(itemBlock, /<pubDate>([\s\S]*?)<\/pubDate>/i);

            if (!title || !link) {
                return null;
            }

            return { title, link, date: pubDate || '' };
        })
        .filter(Boolean);
}

function extractAtomItems(xml) {
    const blocks = xml.match(/<entry>([\s\S]*?)<\/entry>/gi) || [];

    return blocks
        .map(function (entryBlock) {
            const title = firstMatch(entryBlock, /<title[^>]*>([\s\S]*?)<\/title>/i);
            const hrefMatch = entryBlock.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
            const updated = firstMatch(entryBlock, /<(?:updated|published)>([\s\S]*?)<\/(?:updated|published)>/i);

            if (!title || !hrefMatch || !hrefMatch[1]) {
                return null;
            }

            return { title, link: decodeHtml(hrefMatch[1]), date: updated || '' };
        })
        .filter(Boolean);
}

async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'SAYS-Website-Updater/1.0 (+https://saysinternational.vercel.app)'
        }
    });

    if (!response.ok) {
        throw new Error('Request failed for ' + url + ' with status ' + response.status);
    }

    return response.text();
}

function extractTitleFromHtml(html) {
    return firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function chooseBestItem(items, patterns) {
    if (!items.length) {
        return null;
    }

    const loweredPatterns = (patterns || []).map(function (pattern) {
        return pattern.toLowerCase();
    });

    if (!loweredPatterns.length) {
        return items[0];
    }

    const preferred = items.find(function (item) {
        const link = (item.link || '').toLowerCase();
        return loweredPatterns.some(function (pattern) {
            return link.indexOf(pattern) !== -1;
        });
    });

    return preferred || items[0];
}

function formatAccraTimestamp(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Accra',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short'
    }).format(date);
}

async function fetchSourceUpdate(sourceConfig) {
    for (const feedUrl of sourceConfig.feedUrls) {
        try {
            const xml = await fetchText(feedUrl);
            const rssItems = extractRssItems(xml);
            const atomItems = extractAtomItems(xml);
            const allItems = rssItems.concat(atomItems);
            const selectedItem = chooseBestItem(allItems, sourceConfig.preferredLinkPatterns);

            if (selectedItem) {
                return {
                    source: sourceConfig.source,
                    title: selectedItem.title,
                    link: selectedItem.link,
                    date: selectedItem.date,
                    channel: sourceConfig.siteUrl
                };
            }
        } catch (error) {
            // Try next candidate URL.
        }
    }

    const fallbackUrl = sourceConfig.fallbackNewsUrl || sourceConfig.siteUrl;

    try {
        const html = await fetchText(fallbackUrl);
        const title = extractTitleFromHtml(html) || 'Visit official website for latest updates';

        return {
            source: sourceConfig.source,
            title,
            link: fallbackUrl,
            date: '',
            channel: sourceConfig.siteUrl
        };
    } catch (error) {
        return {
            source: sourceConfig.source,
            title: 'Official updates currently unavailable. Open source website.',
            link: fallbackUrl,
            date: '',
            channel: sourceConfig.siteUrl
        };
    }
}

export default async function handler(request, response) {
    try {
        const updates = await Promise.all(SOURCES.map(fetchSourceUpdate));
        const now = new Date();

        response.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
        response.status(200).json({
            generatedAt: now.toISOString(),
            generatedAtAccra: formatAccraTimestamp(now),
            updates
        });
    } catch (error) {
        const now = new Date();
        response.status(500).json({
            generatedAt: now.toISOString(),
            generatedAtAccra: formatAccraTimestamp(now),
            updates: [],
            error: 'Failed to load education updates'
        });
    }
}
