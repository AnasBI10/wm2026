const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const PAYPAL_BASE = "https://api-m.paypal.com";

async function getPayPalToken() {
  const { client_id, secret } = functions.config().paypal;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${client_id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const j = await res.json();
  return j.access_token;
}

exports.paypalWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("nope");
  const event = req.body;
  if (!["PAYMENT.CAPTURE.COMPLETED","CHECKOUT.ORDER.APPROVED"].includes(event.event_type))
    return res.status(200).send("OK");
  try {
    const token = await getPayPalToken();
    const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: req.headers["paypal-auth-algo"],
        cert_url: req.headers["paypal-cert-url"],
        transmission_id: req.headers["paypal-transmission-id"],
        transmission_sig: req.headers["paypal-transmission-sig"],
        transmission_time: req.headers["paypal-transmission-time"],
        webhook_id: functions.config().paypal.webhook_id,
        webhook_event: event,
      })
    });
    const { verification_status } = await verifyRes.json();
    if (verification_status !== "SUCCESS") return res.status(400).send("Invalid");

    const amount = parseFloat(event.resource?.amount?.value || 0);
    const email  = event.resource?.payer?.email_address || "";
    if (amount < 19.99) return res.status(200).send("too low");

    const snap = await db.collection("profiles").where("email","==",email).get();
    if (snap.empty) return res.status(200).send("user not found");

    await db.collection("payments").doc(snap.docs[0].id).set({
      verified: true, paid: true, amount,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).send("OK");
  } catch(e) {
    console.error(e);
    return res.status(500).send("error");
  }
});

exports.fetchWMResults = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  const apiKey = functions.config().apifootball.key;
  try {
    const res = await fetch("https://v3.football.api-sports.io/fixtures?league=1&season=2026", {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "v3.football.api-sports.io" }
    });
    const { response } = await res.json();
    if (!response?.length) return null;

    const list = response.map(f => ({
      id: f.fixture.id, date: f.fixture.date,
      venue: f.fixture.venue?.name || "",
      group: f.league.round,
      home: f.teams.home.name, homeLogo: f.teams.home.logo,
      away: f.teams.away.name, awayLogo: f.teams.away.logo,
      status: f.fixture.status.short,
      elapsed: f.fixture.status.elapsed,
      result: ["FT","AET","PEN"].includes(f.fixture.status.short)
        ? { home: f.goals.home ?? 0, away: f.goals.away ?? 0 } : null,
      live: ["1H","2H","HT","ET","P"].includes(f.fixture.status.short)
        ? { home: f.goals.home ?? 0, away: f.goals.away ?? 0 } : null,
    }));

    await db.doc("data/matches").set({ list, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`✅ ${list.length} Spiele aktualisiert`);
  } catch(e) { console.error(e); }
  return null;
});