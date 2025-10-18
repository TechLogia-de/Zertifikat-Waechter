/**
 * Einfacher Test-Webhook-Server für lokale Tests
 * 
 * Installation:
 *   npm install express body-parser crypto
 * 
 * Start:
 *   node test-webhook-server.js
 * 
 * Teste dann mit URL: http://localhost:3333/webhook
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = 3333;

// CORS Headers erlauben (für lokale Tests)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body Parser mit Raw Body für Signatur-Validierung
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Webhook Endpoint
app.post('/webhook', (req, res) => {
  console.log('\n🔔 Webhook empfangen!');
  console.log('─────────────────────────────────────────');
  console.log('Timestamp:', new Date().toISOString());
  console.log('\n📋 Headers:');
  console.log('  Content-Type:', req.headers['content-type']);
  console.log('  User-Agent:', req.headers['user-agent']);
  console.log('  X-Webhook-Event:', req.headers['x-webhook-event']);
  console.log('  X-Webhook-Signature:', req.headers['x-webhook-signature']);
  console.log('  X-Webhook-Signature-Timestamp:', req.headers['x-webhook-signature-timestamp']);

  // Signatur validieren (wenn vorhanden)
  const signature = req.headers['x-webhook-signature'];
  if (signature) {
    // Beispiel Secret (muss identisch mit dem im Frontend sein!)
    const SECRET = process.env.WEBHOOK_SECRET || 'test-secret-12345';
    
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(req.rawBody)
      .digest('hex');
    
    const receivedSig = signature.replace('sha256=', '');
    
    if (expectedSig === receivedSig) {
      console.log('  ✅ Signatur VALID');
    } else {
      console.log('  ❌ Signatur INVALID');
      console.log('    Expected:', expectedSig);
      console.log('    Received:', receivedSig);
    }
  } else {
    console.log('  ⚠️  Keine Signatur vorhanden');
  }

  console.log('\n📦 Payload:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('─────────────────────────────────────────\n');

  // Erfolgreiche Antwort
  res.status(200).json({
    success: true,
    message: 'Webhook empfangen und verarbeitet',
    received_at: new Date().toISOString()
  });
});

// Server starten
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 Test-Webhook-Server gestartet!                      ║
║                                                           ║
║   URL: http://localhost:${PORT}/webhook                        ║
║                                                           ║
║   Verwende diese URL in der Zertifikat-Wächter App       ║
║   unter Integrationen → Webhook                           ║
║                                                           ║
║   Drücke Ctrl+C zum Beenden                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

