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
  'mma_mixed_martial_arts'  // Correct MMA key here
];

// Helper: filter events started within last 8 hours or same UTC day
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

// Scraper helpers (unchanged)...

async function scrapeSportsurge() {
  try {
    const baseUrl = 'https://sportsurge.net/';
    const html = await fetch(baseUrl).then(r => r.text());
    const $ = cheerio.load(html);
    const matchLinks = [];

    $('.sports-table a').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && title) {
        matchLinks.push({ title, url: href.startsWith('http') ? href : baseUrl.replace(/\/$/, '') + href });
      }
    });

    const results = [];
    for (const { title, url } of matchLinks) {
      const html2 = await fetch(url).then(r => r.text()).catch(() => null);
      if (!html2) continue;
      const $2 = cheerio.load(html2);
      $2('iframe').each((_, f) => {
        const src = $2(f).attr('src');
        if (src) {
          const full = src.startsWith('http') ? src : `https:${src}`;
          results.push({ title, embed: full });
        }
      });
    }
    return results;
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
    const matchLinks = [];

    $('.event__match').each((_, el) => {
      const title = $(el).find('.event__title').text().trim();
      const href = $(el).find('a').attr('href');
      if (href && title) {
        matchLinks.push({ title, url: href.startsWith('http') ? href : baseUrl.replace(/\/$/, '') + href });
      }
    });

    const results = [];
    for (const { title, url } of matchLinks) {
      const html2 = await fetch(url).then(r => r.text()).catch(() => null);
      if (!html2) continue;
      const $2 = cheerio.load(html2);
      $2('iframe').each((_, f) => {
        const src = $2(f).attr('src');
        if (src) {
          const full = src.startsWith('http') ? src : `https:${src}`;
          results.push({ title, embed: full });
        }
      });
    }
    return results;
  } catch (e) {
    console.warn('Streamwoop scraper failed', e);
    return [];
  }
}

async function scrapeAllSources() {
  const sources = [scrapeSportsurge, scrapeStreamwoop /* add more here */];
  const allStreams = [];

  for (const scraper of sources) {
    const res = await scraper();
    if (res.length > 0) {
      allStreams.push(...res);
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

  return unique;
}

// Fetch all events without date filters, then filter locally
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
  // Filter by your criteria here
  return filterLiveOrRecentEvents(allEvents);
}

// API route unchanged except uses updated fetchLiveGames
app.get('/api/live-games', async (req, res) => {
  try {
    const liveGames = await fetchLiveGames();
    const streams = await scrapeAllSources();

    const games = liveGames.map(ev => {
      const matchedStreams = streams
        .filter(s => 
          s.title.toLowerCase().includes(ev.home_team.toLowerCase()) || 
          s.title.toLowerCase().includes(ev.away_team.toLowerCase())
        )
        .map(s => ({
          url: s.embed,
          server: new URL(s.embed).hostname,
          isWorking: true
        }));

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
