const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

const streamServers = [
  'https://streamwish.net/embed/',
  'https://ok.ru/videoembed/',
  'https://daddylivehd.com/embed/',
  'https://vidsrc.me/embed/',
];

// List of sports you want to fetch
const sports = ['NBA', 'NFL', 'NHL', 'Soccer', 'UFC']; // You can expand or adjust

async function fetchLiveSports() {
  const today = new Date().toISOString().slice(0, 10);
  let allEvents = [];

  for (const sport of sports) {
    const url = `https://www.thesportsdb.com/api/v1/json/1/eventsday.php?d=${today}&s=${sport}`;
    console.log(`Fetching ${sport} events from: ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed to fetch ${sport} data, status: ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data?.events) {
        allEvents = allEvents.concat(data.events);
      } else {
        console.log(`No events for ${sport} today.`);
      }
    } catch (error) {
      console.error(`Error fetching ${sport}:`, error);
    }
  }

  // Map all events into your standard structure
  return allEvents.map((event) => {
    const id = event.idEvent;
    const homeTeam = event.strHomeTeam || event.strEvent || 'Unknown Home';
    const awayTeam = event.strAwayTeam || '';
    const league = event.strLeague || 'Unknown League';
    const startTime = event.strTimestamp || `${event.dateEvent || ''} ${event.strTime || ''}`.trim();
    const status = event.strStatus || 'live';
    const homeLogo = event.strHomeTeamBadge || `https://www.thesportsdb.com/images/media/team/badge/${homeTeam}.png` || '/placeholder.svg';
    const awayLogo = event.strAwayTeamBadge || `https://www.thesportsdb.com/images/media/team/badge/${awayTeam}.png` || '/placeholder.svg';

    // Assign 1-3 random streams for demo
    const streams = streamServers
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((baseUrl, idx) => ({
        id: `${id}_stream_${idx}`,
        url: baseUrl + (10000 + Math.floor(Math.random() * 90000)), // fake video id to demo
        quality: idx === 0 ? 'HD' : 'SD',
        server: baseUrl.match(/\/\/([^\/]+)\//)[1],
        isWorking: true,
      }));

    return {
      id,
      homeTeam,
      awayTeam,
      league,
      startTime,
      status,
      homeScore: 0,
      awayScore: 0,
      homeLogo,
      awayLogo,
      streams,
    };
  });
}

app.get('/api/live-games', async (req, res) => {
  try {
    const games = await fetchLiveSports();
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live games' });
  }
});

app.get('/api/game/:id', async (req, res) => {
  try {
    const games = await fetchLiveSports();
    const game = games.find(g => g.id === req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
