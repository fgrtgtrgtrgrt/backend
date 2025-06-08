const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// Utility: mock stream sources to embed for each game
const streamServers = [
  'https://streamwish.net/embed/',
  'https://ok.ru/videoembed/',
  'https://daddylivehd.com/embed/',
  'https://vidsrc.me/embed/',
];

// Example: You could replace this with a real public sports API key & endpoint.
// For demo, we fetch NBA live games from TheSportsDB free API
// Docs: https://www.thesportsdb.com/api.php

async function fetchLiveSports() {
  // Example: fetch NBA events live today (replace or expand for soccer, NHL, UFC, etc)
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://www.thesportsdb.com/api/v1/json/1/eventsday.php?d=${today}&s=NBA`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sports data');
  const data = await res.json();

  // Format into our app's game structure
  const events = data?.events || [];

  return events.map((event, i) => {
    const id = event.idEvent;
    const homeTeam = event.strHomeTeam;
    const awayTeam = event.strAwayTeam;
    const league = event.strLeague;
    const startTime = event.strTimestamp || event.dateEvent + ' ' + event.strTime;
    const status = event.strStatus || 'live'; // Simplified
    const homeLogo = `https://www.thesportsdb.com/images/media/team/badge/${event.strHomeTeam}.png` || '/placeholder.svg';
    const awayLogo = `https://www.thesportsdb.com/images/media/team/badge/${event.strAwayTeam}.png` || '/placeholder.svg';

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
