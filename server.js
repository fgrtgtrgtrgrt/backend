// === backend.js ===
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

const streamServers = [
  'https://streamwish.net/e/',
  'https://ok.ru/videoembed/',
  'https://daddylivehd.sx/embed/',
  'https://vidsrc.to/embed/'
];

const leagues = [
  { id: '4387', name: 'NFL' },
  { id: '4380', name: 'NBA' },
  { id: '4381', name: 'NHL' },
  { id: '4391', name: 'UFC' },
  { id: '4328', name: 'English Premier League' },
];

const API_KEY = '123';

async function fetchLeagueGames(id) {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsday.php?d=${today}&id=${id}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.events || [];
}

async function fetchAllGames() {
  const allGames = [];
  for (const league of leagues) {
    const games = await fetchLeagueGames(league.id);
    games.forEach((event, idx) => {
      const id = event.idEvent;
      const streams = streamServers.map((s, i) => ({
        id: `${id}_${i}`,
        url: s + (10000 + Math.floor(Math.random() * 90000)),
        quality: i === 0 ? 'HD' : 'SD',
        server: s.split('/')[2],
        isWorking: true,
      }));

      allGames.push({
        id,
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        league: event.strLeague,
        startTime: event.strTimestamp || `${event.dateEvent} ${event.strTime}`,
        status: event.strStatus || 'scheduled',
        homeScore: 0,
        awayScore: 0,
        homeLogo: `/placeholder.svg`,
        awayLogo: `/placeholder.svg`,
        streams,
      });
    });
  }
  return allGames;
}

app.get('/api/live-games', async (req, res) => {
  try {
    const games = await fetchAllGames();
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/game/:id', async (req, res) => {
  try {
    const games = await fetchAllGames();
    const game = games.find(g => g.id === req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
