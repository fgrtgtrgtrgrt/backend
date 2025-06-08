const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;
const API_KEY = '123'; // Your free API key

const streamServers = [
  'https://streamwish.net/embed/',
  'https://ok.ru/videoembed/',
  'https://daddylivehd.com/embed/',
  'https://vidsrc.me/embed/',
];

const leagues = {
  NBA: 4387,
  NFL: 4391,
  NHL: 4380,
  Soccer: 4328,
  UFC: 4444,
};

async function fetchLiveSports() {
  let allEvents = [];
  for (const [sport, leagueId] of Object.entries(leagues)) {
    const url = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsnextleague.php?id=${leagueId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.events) {
        allEvents = allEvents.concat(
          data.events.map(event => ({
            id: event.idEvent,
            homeTeam: event.strHomeTeam,
            awayTeam: event.strAwayTeam,
            league: event.strLeague,
            startTime: event.strTimestamp || `${event.dateEvent} ${event.strTime}`,
            status: event.strStatus || 'upcoming',
            homeScore: event.intHomeScore || 0,
            awayScore: event.intAwayScore || 0,
            homeLogo: event.strHomeTeam ? `https://www.thesportsdb.com/images/media/team/badge/${event.strHomeTeam}.png` : '/placeholder.svg',
            awayLogo: event.strAwayTeam ? `https://www.thesportsdb.com/images/media/team/badge/${event.strAwayTeam}.png` : '/placeholder.svg',
            streams: streamServers
              .sort(() => 0.5 - Math.random())
              .slice(0, 3)
              .map((baseUrl, idx) => ({
                id: `${event.idEvent}_stream_${idx}`,
                url: baseUrl + (10000 + Math.floor(Math.random() * 90000)), // fake demo video id
                quality: idx === 0 ? 'HD' : 'SD',
                server: baseUrl.match(/\/\/([^\/]+)\//)[1],
                isWorking: true,
              })),
          }))
        );
      }
    } catch (err) {
      console.error(`Failed to fetch events for ${sport}`, err);
    }
  }
  return allEvents;
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
