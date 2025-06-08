const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;

const ODDS_API_KEY = '4249dc40738171eb70c1b3caf61f538b';
const SPORTS = [
  'americanfootball_nfl',
  'basketball_nba',
  'icehockey_nhl',
  'soccer_epl',
  'mma_mixed_martial_arts'
];

// Helper to filter recent/live events (same as yours)
function filterLiveOrRecentEvents(events) {
  const now = new Date();
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  return events.filter(event => {
    const startTime = new Date(event.commence_time);

    const sameDay =
      startTime.getUTCFullYear() === now.getUTCFullYear() &&
      startTime.getUTCMonth() === now.getUTCMonth() &&
      startTime.getUTCDate() === now.getUTCDate();

    return (startTime >= eightHoursAgo && startTime <= now) || sameDay;
  });
}

// Improved scraping helpers for multiple sources
async function scrapeSportsurge() {
  try {
    const baseUrl = 'https://sportsurge.net/';
    const html = await fetch(baseUrl).then(r => r.text());
    const $ = cheerio.load(html);
    const results = [];

    // Instead of relying only on '.sports-table a' links,
    // also look for live match cards or other containers
    $('a.sports-table__item, .sports-table a').each((_, el) => {
      const title = $(el).text().trim();
      let href = $(el).attr('href');
      if (!href) return;

      if (!href.startsWith('http')) {
        href = baseUrl.replace(/\/$/, '') + href;
      }

      results.push({ title, url: href });
    });

    const streams = [];

    for (const { title, url } of results) {
      try {
        const html2 = await fetch(url).then(r => r.text());
        const $2 = cheerio.load(html2);

        // Instead of just iframe, check for video, embed, source tags as well
        $2('iframe, video, embed, source').each((_, el) => {
          const src = $2(el).attr('src') || $2(el).attr('data-src');
          if (src) {
            const full = src.startsWith('http') ? src : `https:${src}`;
            streams.push({ title, embed: full });
          }
        });
      } catch {
        // Ignore fetch errors for individual pages
      }
    }
    console.log('Sportsurge streams found:', streams.length);
    return streams;
  } catch (e) {
    console.warn('Sportsurge scraper failed', e);
    return [];
  }
}

async function scrapeStreamwoop() {
  try {
    const baseUrl = 'https://streamwoop.com/';
    const html = await fetch(baseUrl).then(r => r.text());
    const $ = cheerio.load(html);
    const results = [];

    // Look for multiple event match selectors to avoid missing matches
    $('.event__match, .event__block a.event__match').each((_, el) => {
      const title = $(el).find('.event__title').text().trim() || $(el).text().trim();
      let href = $(el).attr('href');
      if (!href) return;

      if (!href.startsWith('http')) {
        href = baseUrl.replace(/\/$/, '') + href;
      }
      results.push({ title, url: href });
    });

    const streams = [];

    for (const { title, url } of results) {
      try {
        const html2 = await fetch(url).then(r => r.text());
        const $2 = cheerio.load(html2);
        $2('iframe, video, embed, source').each((_, el) => {
          const src = $2(el).attr('src') || $2(el).attr('data-src');
          if (src) {
            const full = src.startsWith('http') ? src : `https:${src}`;
            streams.push({ title, embed: full });
          }
        });
      } catch {
        // Ignore fetch errors for individual pages
      }
    }

    console.log('Streamwoop streams found:', streams.length);
    return streams;
  } catch (e) {
    console.warn('Streamwoop scraper failed', e);
    return [];
  }
}

// New source: CrackStreams (example)
async function scrapeCrackStreams() {
  try {
    const baseUrl = 'https://crackstreams.com/'; // Verify if site is up or use alternative
    const html = await fetch(baseUrl).then(r => r.text());
    const $ = cheerio.load(html);
    const streams = [];

    // This site often uses tables with links or divs with stream info
    $('a[href*="embed"], a[href*="stream"]').each((_, el) => {
      const title = $(el).text().trim() || $(el).attr('title') || 'CrackStreams match';
      let href = $(el).attr('href');
      if (!href) return;

      if (!href.startsWith('http')) {
        href = baseUrl.replace(/\/$/, '') + href;
      }
      streams.push({ title, embed: href });
    });

    console.log('CrackStreams streams found:', streams.length);
    return streams;
  } catch (e) {
    console.warn('CrackStreams scraper failed', e);
    return [];
  }
}

// New source: BuffStreams (example)
async function scrapeBuffStreams() {
  try {
    const baseUrl = 'https://buffstreamz.com/'; // Confirm current URL
    const html = await fetch(baseUrl).then(r => r.text());
    const $ = cheerio.load(html);
    const streams = [];

    // Usually, links with class or iframe embeds
    $('a[href*="embed"]').each((_, el) => {
      const title = $(el).text().trim() || 'BuffStreams match';
      let href = $(el).attr('href');
      if (!href) return;

      if (!href.startsWith('http')) {
        href = baseUrl.replace(/\/$/, '') + href;
      }
      streams.push({ title, embed: href });
    });

    console.log('BuffStreams streams found:', streams.length);
    return streams;
  } catch (e) {
    console.warn('BuffStreams scraper failed', e);
    return [];
  }
}

// Add more sources here with similar robust selectors and fallback options

// Master function to scrape all sources
async function scrapeAllSources() {
  const sources = [
    scrapeSportsurge,
    scrapeStreamwoop,
    scrapeCrackStreams,
    scrapeBuffStreams
    // add more scraper functions here
  ];
  const allStreams = [];

  for (const scraper of sources) {
    try {
      const streams = await scraper();
      if (streams.length > 0) {
        allStreams.push(...streams);
      }
    } catch (e) {
      console.warn('Error in scraper:', e);
    }
  }

  // Remove duplicates by embed URL
  const unique = [];
  const seen = new Set();
  for (const s of allStreams) {
    if (!seen.has(s.embed)) {
      unique.push(s);
      seen.add(s.embed);
    }
  }

  console.log('Total unique streams scraped:', unique.length);
  return unique;
}

async function fetchLiveGames() {
  console.log(`Fetching all events for sports: ${SPORTS.join(', ')}`);

  const results = await Promise.all(
    SPORTS.map(async sport => {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`;
      console.log('Fetching:', url);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Failed to fetch ${sport} events. Status: ${res.status}`);
          return [];
        }
        const data = await res.json();
        console.log(`Got ${data.length} events for ${sport}`);
        return data;
      } catch (e) {
        console.warn(`Error fetching ${sport} events:`, e);
        return [];
      }
    })
  );

  const allEvents = results.flat();
  return filterLiveOrRecentEvents(allEvents);
}

app.get('/api/live-games', async (req, res) => {
  try {
    const liveGames = await fetchLiveGames();
    const streams = await scrapeAllSources();

    // relaxed matching helper
    const clean = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    const games = liveGames.map(ev => {
      const home = clean(ev.home_team);
      const away = clean(ev.away_team);

      const matchedStreams = streams.filter(s => {
        const t = clean(s.title);
        return t.includes(home) || t.includes(away);
      }).map(s => ({
        url: s.embed,
        server: new URL(s.embed).hostname,
        isWorking: true
      }));

      if (matchedStreams.length === 0) {
        console.log(`No streams matched for ${ev.home_team} vs ${ev.away_team}`);
      }

      return {
        id: ev.id,
        homeTeam: ev.home_team,
        awayTeam: ev.away_team,
        league: ev.sport_key,
        startTime: ev.commence_time,
        status: ev.completed ? 'finished' : (new Date(ev.commence_time) <= new Date() ? 'live' : 'upcoming'),
        homeScore: ev.scores?.find(s => s.name === ev.home_team)?.score ?? null,
        awayScore: ev.scores?.find(s => s.name === ev.away_team)?.score ?? null,
        streams: matchedStreams,
      };
    });

    res.json(games);
  } catch (e) {
    console.error('API error', e);
    res.status(500).json({ error: 'Failed to fetch live games with streams' });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
