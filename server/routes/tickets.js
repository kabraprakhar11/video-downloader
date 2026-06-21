const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const tickets = new Map();
const TICKET_EXPIRY_MS = 60 * 60 * 1000;

router.post('/', (req, res) => {
  const { url, videoUrl, audioUrl, title, ext, type } = req.body;
  
  if (!url && (!videoUrl || !audioUrl)) {
    return res.status(400).json({ error: 'Stream URLs are required.' });
  }

  const ticketId = crypto.randomUUID();
  
  tickets.set(ticketId, {
    url,
    videoUrl,
    audioUrl,
    title: title || 'download',
    ext: ext || 'mp4',
    type: type || 'proxy',
    createdAt: Date.now()
  });

  // Cleanup old tickets
  for (const [id, ticket] of tickets.entries()) {
    if (Date.now() - ticket.createdAt > TICKET_EXPIRY_MS) {
      tickets.delete(id);
    }
  }

  res.json({ ticketId });
});

module.exports = { ticketsRoute: router, tickets };
