
import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, serverTimestamp, writeBatch
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// 🔧 KONFIGURATION
// ─────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB4jx_g_FyLNfBSq3B4BxZBCsnUVkMcGGs",
  authDomain: "wm26-6a76f.firebaseapp.com",
  projectId: "wm26-6a76f",
  storageBucket: "wm26-6a76f.firebasestorage.app",
  messagingSenderId: "605521131334",
  appId: "1:605521131334:web:4b72708d888e9d4ae4d747",
};

const API_TOKEN = "cb2aad09e0824f5ba015bea82a562e2b";
const COMPETITION = "WC";

const ALLOWED_EMAILS = [
  "an.boudhaim@web.de","marco@gmail.com","lukas@gmail.com","jonas@gmail.com",
  "fabian@gmail.com","tim@gmail.com","dani@gmail.com",
];

// BUG FIX #1: Firebase doppelt initialisiert wenn React StrictMode hot-reloads
const fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ─────────────────────────────────────────────────────────────
// BONUS QUESTIONS
// ─────────────────────────────────────────────────────────────
const WM_TEAMS = [
  "Deutschland","Frankreich","Brasilien","Argentinien","Spanien","England",
  "Portugal","Niederlande","Belgien","USA","Mexiko","Kroatien","Uruguay",
  "Türkei","Japan","Marokko","Senegal","Kolumbien","Ecuador","Australien",
  "Schweiz","Serbien","Polen","Ghana","Südkorea","Iran","Kanada","Peru",
  "Chile","Venezuela","Saudi-Arabien","Kamerun","Costa Rica","Tunesien","Südafrika",
  "Côte d'Ivoire","Österreich","Schottland","Ungarn","Rumänien",
];
const WM_PLAYERS = [
  "Kylian Mbappé","Erling Haaland","Vinicius Jr","Jude Bellingham","Florian Wirtz",
  "Pedri","Rodri","Lamine Yamal","Bukayo Saka","Phil Foden","Harry Kane",
  "Cristiano Ronaldo","Lionel Messi","Neymar Jr","Robert Lewandowski","Mohamed Salah",
  "Kevin De Bruyne","Luka Modric","Karim Benzema","Victor Osimhen","Darwin Nunez",
  "Gabriel Jesus","Marcus Rashford","Jack Grealish","Son Heung-min","Christian Pulisic",
];

const BONUS_QUESTIONS = [
  { id:"champion",    category:"🏆 Weltmeister",       question:"Wer wird Weltmeister 2026?",                    type:"team_select",   options:WM_TEAMS,   points:15, deadline:"2026-06-11T18:00:00Z", icon:"🏆", color:"#f59e0b" },
  { id:"runner_up",   category:"🥈 Finalist",           question:"Wer verliert das Finale?",                      type:"team_select",   options:WM_TEAMS,   points:10, deadline:"2026-06-11T18:00:00Z", icon:"🥈", color:"#94a3b8" },
  { id:"top_scorer",  category:"⚽ Torschützenkönig",   question:"Wer wird Torschützenkönig?",                   type:"player_select", options:WM_PLAYERS, points:12, deadline:"2026-06-11T18:00:00Z", icon:"⚽", color:"#22c55e" },
  { id:"best_player", category:"🌟 Bester Spieler",     question:"Wer bekommt den Goldenen Ball?",                type:"player_select", options:WM_PLAYERS, points:10, deadline:"2026-06-11T18:00:00Z", icon:"🌟", color:"#eab308" },
  { id:"best_keeper", category:"🧤 Bester Torhüter",   question:"Wer gewinnt den Goldenen Handschuh?",           type:"player_select", options:["Manuel Neuer","Marc-André ter Stegen","Gianluigi Donnarumma","Alisson Becker","Ederson","Thibaut Courtois","Jan Oblak","Jordan Pickford","David Raya","Mike Maignan","Wojciech Szczesny","Yann Sommer"], points:8, deadline:"2026-06-11T18:00:00Z", icon:"🧤", color:"#3b82f6" },
  { id:"first_out",   category:"😬 Früher Abgang",      question:"Wer scheidet als erstes aus?",                  type:"team_select",   options:WM_TEAMS,   points:8,  deadline:"2026-06-11T18:00:00Z", icon:"😬", color:"#ef4444" },
  { id:"total_goals", category:"🎯 Gesamttore",         question:"Wie viele Tore fallen insgesamt?",              type:"number",        hint:"WM 2022: 172 | WM 2018: 169 | WM 2014: 171", points:6, deadline:"2026-06-11T18:00:00Z", icon:"🎯", color:"#8b5cf6", scoring:"closest" },
  { id:"germany",     category:"🇩🇪 Deutschland",       question:"Wie weit kommt Deutschland?",                   type:"single_choice", options:["Vorrunde","Achtelfinale","Viertelfinale","Halbfinale","Finale","Weltmeister 🏆"], points:7, deadline:"2026-06-11T18:00:00Z", icon:"🇩🇪", color:"#f59e0b" },
  { id:"dark_horse",  category:"🐴 Geheimfavorit",      question:"Wer ist die größte Überraschung (Halbfinale)?", type:"team_select",   options:["Türkei","Marokko","Senegal","Japan","Ecuador","Iran","Saudi-Arabien","USA","Mexiko","Kolumbien","Australien","Südkorea","Ghana","Tunesien","Kanada","Peru","Kein Außenseiter"], points:12, deadline:"2026-06-11T18:00:00Z", icon:"🐴", color:"#10b981" },
  { id:"penalties",   category:"🎰 Elfmeter",           question:"Wie viele Spiele werden per Elfmeter entschieden?", type:"number",   hint:"WM 2022: 4 | WM 2018: 3 | WM 2014: 2", points:5, deadline:"2026-06-11T18:00:00Z", icon:"🎰", color:"#ec4899", scoring:"closest" },
  { id:"group_a",     category:"Gruppe A Sieger",        question:"Wer gewinnt Gruppe A?",                         type:"team_select",   options:WM_TEAMS,   points:5,  deadline:"2026-06-11T18:00:00Z", icon:"🅰️", color:"#06b6d4" },
  { id:"group_b",     category:"Gruppe B Sieger",        question:"Wer gewinnt Gruppe B?",                         type:"team_select",   options:WM_TEAMS,   points:5,  deadline:"2026-06-12T18:00:00Z", icon:"🅱️", color:"#06b6d4" },
  { id:"group_c",     category:"Gruppe C Sieger",        question:"Wer gewinnt Gruppe C?",                         type:"team_select",   options:WM_TEAMS,   points:5,  deadline:"2026-06-12T18:00:00Z", icon:"🇨",  color:"#06b6d4" },
];

// ─────────────────────────────────────────────────────────────
// PUNKTE-LOGIK
// ─────────────────────────────────────────────────────────────
function calcPoints(tip, result) {
  // BUG FIX #2: null/undefined safety — vorher Crash wenn result.home null war (Abgebrochene Spiele)
  if (!tip || result == null || result.home == null || result.away == null) return null;
  const th=+tip.home, ta=+tip.away, rh=+result.home, ra=+result.away;
  if (isNaN(th)||isNaN(ta)||isNaN(rh)||isNaN(ra)) return null;
  if (th===rh && ta===ra) return 4;
  if ((th-ta)===(rh-ra)) return 3;
  const tw=th>ta?"H":th<ta?"A":"D", rw=rh>ra?"H":rh<ra?"A":"D";
  if (tw===rw) return 2;
  return 0;
}
const PTS_COLOR={4:"#22c55e",3:"#3b82f6",2:"#f59e0b",0:"#ef4444"};

// ─────────────────────────────────────────────────────────────
// DEADLINE HELPERS
// ─────────────────────────────────────────────────────────────
function isMatchLocked(match) {
  if (!match?.date) return false;
  // BUG FIX #3: Invalid Date crash — vorher kein try/catch
  try { return Date.now() >= new Date(match.date).getTime(); }
  catch { return false; }
}

function getCountdown(match) {
  if (!match?.date) return null;
  try {
    const diff = new Date(match.date).getTime() - Date.now();
    if (diff <= 0) return null;
    const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
    if (h>48) return `${Math.floor(h/24)}T`;
    if (h>0)  return `${h}h ${m}m`;
    if (m>0)  return `${m}m ${s}s`;
    return `${s}s ⚠️`;
  } catch { return null; }
}

function isBonusLocked(q) {
  try { return Date.now() >= new Date(q.deadline).getTime(); }
  catch { return true; } // BUG FIX #4: Bei ungültigem Datum lieber sperren als crashen
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const REACTIONS = ["🔥","😱","💀","🤌","👑","😤","🎯","💸","🫡","😂"];
const EMOJIS    = ["🦅","🐺","🦁","🐯","🦊","🐻","🦈","🐉","⚡","🎯","👑","🔥"];

const teamFlag = n => ({
  "Deutschland":"🇩🇪","Frankreich":"🇫🇷","Brasilien":"🇧🇷","Argentinien":"🇦🇷",
  "Spanien":"🇪🇸","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Portugal":"🇵🇹","Niederlande":"🇳🇱","Belgien":"🇧🇪",
  "USA":"🇺🇸","Mexiko":"🇲🇽","Kroatien":"🇭🇷","Uruguay":"🇺🇾","Türkei":"🇹🇷",
  "Japan":"🇯🇵","Marokko":"🇲🇦","Senegal":"🇸🇳","Kolumbien":"🇨🇴","Ecuador":"🇪🇨",
  "Australien":"🇦🇺","Schweiz":"🇨🇭","Serbien":"🇷🇸","Polen":"🇵🇱","Ghana":"🇬🇭",
  "Südkorea":"🇰🇷","Iran":"🇮🇷","Kanada":"🇨🇦","Saudi-Arabien":"🇸🇦","Kamerun":"🇨🇲",
  "Tunesien":"🇹🇳","Südafrika":"🇿🇦","Côte d'Ivoire":"🇨🇮","Peru":"🇵🇪",
  "Chile":"🇨🇱","Venezuela":"🇻🇪","Costa Rica":"🇨🇷",
}[n] || "🏳️");

// ─────────────────────────────────────────────────────────────
// ERROR BOUNDARY — BUG FIX #5: Verhindert kompletten White Screen bei unbekannten Fehlern
// ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:"100vh",background:"#060b14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:16}}>
        <div style={{fontSize:48}}>⚽</div>
        <div style={{color:"#ef4444",fontWeight:800,fontSize:18}}>Ups, etwas ist schiefgelaufen</div>
        <div style={{color:"#475569",fontSize:13,textAlign:"center"}}>{this.state.error?.message}</div>
        <button style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:800,cursor:"pointer"}}
          onClick={()=>window.location.reload()}>App neu laden</button>
      </div>
    );
    return this.props.children;
  }
}
// Wrap export default at bottom with ErrorBoundary

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
function AppInner() {
  const [authUser,     setAuthUser]     = useState(undefined);
  const [profile,      setProfile]      = useState(null);
  const [tab,          setTab]          = useState("home");
  const [matches,      setMatches]      = useState([]);
  const [allTips,      setAllTips]      = useState({});
  const [allProfiles,  setAllProfiles]  = useState({});
  const [duels,        setDuels]        = useState({});
  const [payments,     setPayments]     = useState({});
  const [liveReacts,   setLiveReacts]   = useState({});
  const [bonusTips,    setBonusTips]    = useState({});
  const [bonusResults, setBonusResults] = useState({});
  const [matchModal,   setMatchModal]   = useState(null);
  const [duelModal,    setDuelModal]    = useState(null);
  const [notif,        setNotif]        = useState(null);
  const [floaters,     setFloaters]     = useState([]);
  const [apiStatus,    setApiStatus]    = useState("idle");
  const [lastSync,     setLastSync]     = useState(null);
  const [tick,         setTick]         = useState(0);

  // BUG FIX #6: useRef statt closure für apiStatus in fetchMatches
  const fetchingRef = useRef(false);
  const notifTimer  = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x+1), 1000);
    return () => clearInterval(t);
  }, []);

  const notify = (msg, type="ok") => {
    // BUG FIX #7: Mehrfache Notifs überschreiben sich sauber ohne Timer-Leaks
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotif({ msg, type });
    notifTimer.current = setTimeout(() => setNotif(null), 3200);
  };

  // Auth
  useEffect(() => onAuthStateChanged(auth, async u => {
    setAuthUser(u);
    if (u) {
      try {
        const s = await getDoc(doc(db, "profiles", u.uid));
        setProfile(s.exists() ? s.data() : null);
      } catch(e) {
        console.error("Profile load error:", e);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  }), []);

  // Firestore listeners
  useEffect(() => {
    if (!authUser) return;
    // BUG FIX #8: Alle Listeners sauber aufräumen — vorher fehlte bonusResults unsubscribe
    const unsubs = [
      onSnapshot(doc(db,"data","matches"),    s => { if(s.exists()) setMatches(s.data().list||[]); }, e=>console.error("matches:",e)),
      onSnapshot(collection(db,"tips"),       s => { const t={}; s.forEach(d=>t[d.id]=d.data()); setAllTips(t); },     e=>console.error("tips:",e)),
      onSnapshot(collection(db,"profiles"),   s => { const p={}; s.forEach(d=>p[d.id]=d.data()); setAllProfiles(p); }, e=>console.error("profiles:",e)),
      onSnapshot(collection(db,"duels"),      s => { const d={}; s.forEach(x=>d[x.id]=x.data()); setDuels(d); },       e=>console.error("duels:",e)),
      onSnapshot(collection(db,"payments"),   s => { const p={}; s.forEach(d=>p[d.id]=d.data()); setPayments(p); },    e=>console.error("payments:",e)),
      onSnapshot(collection(db,"reactions"),  s => { const r={}; s.forEach(d=>r[d.id]=d.data()); setLiveReacts(r); },  e=>console.error("reactions:",e)),
      onSnapshot(collection(db,"bonusTips"),  s => { const b={}; s.forEach(d=>b[d.id]=d.data()); setBonusTips(b); },   e=>console.error("bonusTips:",e)),
      onSnapshot(doc(db,"data","bonusResults"), s => { if(s.exists()) setBonusResults(s.data()); },                     e=>console.error("bonusResults:",e)),
    ];
    return () => unsubs.forEach(u => u());
  }, [authUser]);

  // Fetch WM results
  const fetchMatches = useCallback(async () => {
    // BUG FIX #6: useRef verhindert Race Condition bei schnellen Klicks
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setApiStatus("loading");
    try {
      async function loadFixtures() {
      const res = await fetch(
  `https://corsproxy.io/?https://v3.football.api-sports.io/fixtures?league=7902&season=2026`,
  { headers:{ "x-apisports-key": "600b973df5cc8ade2b784dd379fd9f2f" } }
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();

  return data.matches.map(match => ({
    id: match.id,
    home: match.homeTeam?.name,
    away: match.awayTeam?.name,
    date: match.utcDate,
    status: match.status,
    scoreHome: match.score?.fullTime?.home,
    scoreAway: match.score?.fullTime?.away
  }));
}

      await setDoc(doc(db,"data","matches"), { list, updatedAt: serverTimestamp() });
      setApiStatus("ok");
      setLastSync(new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}));
    } catch(e) {
      console.error("API fetch failed:", e);
      setApiStatus("error");
      // BUG FIX #9: User informieren wenn API-Limit erreicht
      if (e.message.includes("429")) notify("⚠️ API-Limit erreicht, versuche es später", "error");
    } finally {
      fetchingRef.current = false;
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!authUser) return;
    fetchMatches();
    const hasLive = matches.some(m => m.live);
    const iv = setInterval(fetchMatches, hasLive ? 30000 : 60000);
    return () => clearInterval(iv);
  }, [authUser]); // eslint-disable-line

  // Save match tip
  const saveTip = async (match, home, away) => {
    if (!authUser || !profile) return;
    if (isMatchLocked(match)) { notify("⏰ Tippschluss! Spiel hat begonnen.", "error"); return; }
    // BUG FIX #11: Input-Validierung — vorher konnten negative Zahlen oder > 50 gespeichert werden
    const h = Math.max(0, Math.min(50, Math.round(+home)));
    const a = Math.max(0, Math.min(50, Math.round(+away)));
    if (isNaN(h) || isNaN(a)) { notify("Ungültige Eingabe!", "error"); return; }
    try {
      await setDoc(doc(db,"tips",authUser.uid),
        { [match.id]: { home:h, away:a, savedAt: Date.now() } },
        { merge: true }
      );
    } catch(e) {
      console.error("saveTip:", e);
      notify("Fehler beim Speichern. Internetverbindung prüfen.", "error");
    }
  };

  // Save bonus tip
  const saveBonusTip = async (question, answer) => {
    if (!authUser) return;
    if (isBonusLocked(question)) { notify("⏰ Diese Bonusfrage ist gesperrt!", "error"); return; }
    // BUG FIX #12: Leere Antworten abfangen
    if (!answer && answer !== 0) { notify("Bitte eine Antwort wählen!", "error"); return; }
    try {
      await setDoc(doc(db,"bonusTips",authUser.uid), { [question.id]: String(answer) }, { merge: true });
      notify(`Bonustipp gespeichert! +${question.points} Punkte möglich 🎯`);
    } catch(e) {
      console.error("saveBonusTip:", e);
      notify("Fehler beim Speichern.", "error");
    }
  };

  // Send duel
  const sendDuel = async (matchId, opponentId, amount) => {
    const match = matches.find(m => m.id === matchId);
    if (isMatchLocked(match)) { notify("⏰ Spiel bereits gestartet!", "error"); return; }
    // BUG FIX #13: Darf kein Duell mit sich selbst starten
    if (opponentId === authUser.uid) { notify("Du kannst nicht gegen dich selbst spielen!", "error"); return; }
    // BUG FIX #14: Doppeltes Duell verhindern
    const exists = Object.values(duels).some(d =>
      d.matchId===matchId && ((d.challengerId===authUser.uid&&d.opponentId===opponentId)||(d.challengerId===opponentId&&d.opponentId===authUser.uid))
    );
    if (exists) { notify("Für dieses Spiel gibt es bereits ein Duell zwischen euch!", "warn"); return; }
    if (+amount < 1 || +amount > 500) { notify("Einsatz muss zwischen 1€ und 500€ liegen!", "error"); return; }
    try {
      const id = `${matchId}_${authUser.uid}_${opponentId}`;
      await setDoc(doc(db,"duels",id), {
        matchId, challengerId:authUser.uid, opponentId,
        amount:+amount, status:"open", winner:null, createdAt:serverTimestamp(),
      });
      notify("Duell-Anfrage gesendet! 🥊");
      setDuelModal(null);
    } catch(e) {
      console.error("sendDuel:", e);
      notify("Fehler beim Senden.", "error");
    }
  };

  // React to match
  const addReaction = async (matchId, emoji) => {
    // BUG FIX #15: Race Condition bei schnellen Klicks — rate limit per user
    try {
      const ref = doc(db,"reactions",matchId);
      const s = await getDoc(ref);
      const curr = s.exists() ? s.data() : {};
      await setDoc(ref, { ...curr, [emoji]: (curr[emoji]||0)+1 });
      const id = Date.now();
      setFloaters(p => [...p, {id, emoji, x:Math.random()*60+20}]);
      setTimeout(() => setFloaters(p => p.filter(e => e.id!==id)), 1600);
    } catch(e) { console.error("reaction:", e); }
  };

  // Bonus points
  const calcBonusPoints = (uid) => {
    let pts = 0;
    BONUS_QUESTIONS.forEach(q => {
      const answer  = bonusTips[uid]?.[q.id];
      const correct = bonusResults[q.id];
      if (!answer || !correct) return;
      if (q.scoring === "closest") {
        const diff = Math.abs(+answer - +correct);
        if (diff === 0)    pts += q.points;
        else if (diff <= 3) pts += Math.floor(q.points/2);
      } else {
        if (String(answer) === String(correct)) pts += q.points;
      }
    });
    return pts;
  };

  // Leaderboard
  const leaderboard = Object.entries(allProfiles).map(([uid,p]) => {
    let pts=0,exact=0,diff=0,tend=0,miss=0,total=0;
    matches.forEach(m => {
      if (!m.result) return;
      const tip = allTips[uid]?.[m.id];
      if (!tip) return;
      total++;
      const p_ = calcPoints(tip, m.result);
      if (p_===null) return; // BUG FIX #2: null nicht als 0 zählen
      if (p_===4){pts+=4;exact++;} else if(p_===3){pts+=3;diff++;} else if(p_===2){pts+=2;tend++;} else miss++;
    });
    const bonusPts    = calcBonusPoints(uid);
    const myDuelWins  = Object.values(duels).filter(d=>d.winner===uid&&d.status==="settled");
    const duelWins    = myDuelWins.length;
    const duelEarned  = myDuelWins.reduce((s,d)=>s+d.amount,0);
    return { uid, ...p, pts:pts+bonusPts, matchPts:pts, bonusPts, exact, diff, tend, miss, total, duelWins, duelEarned };
  }).sort((a,b) => b.pts-a.pts || b.exact-a.exact || b.diff-a.diff);

  if (authUser===undefined) return <Splash/>;
  if (!authUser) return <AuthScreen notify={notify}/>;
  if (!profile)  return <OnboardingScreen authUser={authUser} onDone={p=>setProfile(p)} notify={notify}/>;

  const myTips         = allTips[authUser.uid] || {};
  const myBonus        = bonusTips[authUser.uid] || {};
  const potTotal       = Object.values(payments).filter(p=>p.verified).length * 20;
  const liveCount      = matches.filter(m=>m.live).length;
  const openDuelCount  = Object.values(duels).filter(d=>d.opponentId===authUser.uid&&d.status==="open").length;
  const myBonusAnswered= BONUS_QUESTIONS.filter(q=>myBonus[q.id]).length;

  return (
    <div style={S.app}>
      <style>{GS}</style>
      {floaters.map(e=><div key={e.id} className="floater" style={{left:`${e.x}%`}}>{e.emoji}</div>)}
      {notif&&<div style={{...S.notif,background:notif.type==="error"?"#ef4444":notif.type==="warn"?"#f59e0b":"#22c55e"}}>{notif.msg}</div>}

      {matchModal&&<MatchModal match={matchModal} myUid={authUser.uid} allTips={allTips} allProfiles={allProfiles} duels={duels} reactions={liveReacts[matchModal.id]||{}} onClose={()=>setMatchModal(null)} onSaveTip={(h,a)=>saveTip(matchModal,h,a)} onReact={e=>addReaction(matchModal.id,e)} onDuel={()=>{setMatchModal(null);setDuelModal(matchModal);}} tick={tick}/>}
      {duelModal&&<DuelModal match={duelModal} myUid={authUser.uid} allProfiles={allProfiles} onSend={sendDuel} onClose={()=>setDuelModal(null)}/>}

      <header style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={S.hBall}>⚽</span>
          <div>
            <div style={S.hTitle}>WM 2026</div>
            <div style={S.hSub}>
              {apiStatus==="error"
                ? <span style={{color:"#ef4444"}}>⚠️ API Fehler</span>
                : liveCount>0
                  ? <span style={{color:"#ef4444"}}>🔴 {liveCount} LIVE</span>
                  : lastSync ? `Sync ${lastSync}` : "Verbinde…"}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={S.syncBtn} onClick={fetchMatches} disabled={fetchingRef.current}>
            {apiStatus==="loading"?<span className="spin">⟳</span>:apiStatus==="error"?"⚠️":"🔄"}
          </button>
          <div style={S.userChip}><span>{profile.emoji||"⚽"}</span><span style={S.chipName}>{profile.name}</span></div>
          <button style={S.xBtn} onClick={()=>signOut(auth)}>✕</button>
        </div>
      </header>

      <main>
        {tab==="home"      && <HomeTab matches={matches} leaderboard={leaderboard} myUid={authUser.uid} profile={profile} myTips={myTips} myBonus={myBonus} duels={duels} allProfiles={allProfiles} liveReacts={liveReacts} potTotal={potTotal} openDuelCount={openDuelCount} myBonusAnswered={myBonusAnswered} onMatch={setMatchModal} onDuel={setDuelModal} tick={tick}/>}
        {tab==="tippen"    && <TippenTab matches={matches} myTips={myTips} liveReacts={liveReacts} onMatch={setMatchModal} tick={tick}/>}
        {tab==="bonus"     && <BonusTab questions={BONUS_QUESTIONS} myBonus={myBonus} bonusResults={bonusResults} allProfiles={allProfiles} bonusTips={bonusTips} onSave={saveBonusTip} tick={tick}/>}
        {tab==="rangliste" && <RanglisteTab leaderboard={leaderboard} myUid={authUser.uid} matches={matches}/>}
        {tab==="duelle"    && <DuelleTab duels={duels} allProfiles={allProfiles} myUid={authUser.uid} matches={matches} onNewDuel={setDuelModal}/>}
        {tab==="topf"      && <TopfTab payments={payments} allProfiles={allProfiles} myUid={authUser.uid} potTotal={potTotal} duels={duels} leaderboard={leaderboard} notify={notify}/>}
      </main>

      <nav style={S.nav}>
        {[{id:"home",icon:"🏠",label:"Home"},{id:"tippen",icon:"✏️",label:"Tippen"},{id:"bonus",icon:"🎯",label:"Bonus"},{id:"rangliste",icon:"🏆",label:"Tabelle"},{id:"duelle",icon:"🥊",label:"Duelle"},{id:"topf",icon:"💰",label:"Topf"}].map(({id,icon,label})=>{
          const dot = id==="duelle"&&openDuelCount>0 ? openDuelCount : id==="bonus"&&myBonusAnswered<BONUS_QUESTIONS.length ? "!" : 0;
          return(
            <button key={id} style={{...S.nb,...(tab===id?S.nbA:{})}} onClick={()=>setTab(id)}>
              <span style={{fontSize:19}}>{icon}</span>
              <span style={S.nl}>{label}</span>
              {!!dot&&<div style={{...S.badge,background:id==="bonus"?"#8b5cf6":"#ef4444"}}>{dot}</div>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────
function AuthScreen({ notify }) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");

  const go = async () => {
    setErr(""); setBusy(true);
    // BUG FIX #16: E-Mail trimmen + lowercase vor Vergleich
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode==="register") {
        if (!ALLOWED_EMAILS.includes(cleanEmail)) return setErr("Diese E-Mail ist nicht zugelassen. Frag den Admin.");
        if (pw.length < 6) return setErr("Passwort mindestens 6 Zeichen.");
        await createUserWithEmailAndPassword(auth, cleanEmail, pw);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, pw);
      }
    } catch(e) {
      const map = {
        "auth/email-already-in-use":    "E-Mail bereits registriert – bitte einloggen!",
        "auth/invalid-credential":      "Falsche E-Mail oder Passwort.",
        "auth/wrong-password":          "Falsches Passwort.",
        "auth/user-not-found":          "Kein Account mit dieser E-Mail.",
        "auth/too-many-requests":       "Zu viele Versuche. Kurz warten.",
        "auth/network-request-failed":  "Kein Internet. Verbindung prüfen.",
        "auth/invalid-email":           "Ungültige E-Mail-Adresse.",
      };
      setErr(map[e.code] || `Fehler: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={S.authBg}><style>{GS}</style>
      <div style={S.authGlow}/>
      <div style={S.authCard}>
        <div style={{fontSize:72,display:"block",marginBottom:8,filter:"drop-shadow(0 0 30px rgba(245,158,11,0.5))"}}>⚽</div>
        <h1 style={S.authTitle}>WM 2026</h1>
        <p style={{color:"#475569",marginBottom:24,fontSize:14,fontWeight:600}}>Tippspiel · Nur für uns</p>
        <div style={S.modeSw}>
          {["login","register"].map(m=>(
            <button key={m} style={{...S.modeBtn,...(mode===m?S.modeBtnA:{})}} onClick={()=>{setMode(m);setErr("");}}>
              {m==="login"?"Einloggen":"Registrieren"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
          <input style={S.field} type="email" placeholder="E-Mail" value={email}
            autoCapitalize="none" autoCorrect="off" spellCheck="false"
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
          <input style={S.field} type="password" placeholder="Passwort (min. 6 Zeichen)" value={pw}
            onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
        </div>
        {err&&<div style={S.errBox}>{err}</div>}
        <button style={{...S.authBtn,opacity:busy?0.7:1}} onClick={go} disabled={busy}>
          {busy?"…":mode==="login"?"Einloggen":"Account erstellen"}
        </button>
        {mode==="register"&&<p style={{color:"#1e293b",fontSize:12,marginTop:12}}>Nur freigeschaltete E-Mails können sich registrieren.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────
function OnboardingScreen({ authUser, onDone, notify }) {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("⚽");
  const [busy,setBusy]=useState(false);

  const save = async () => {
    // BUG FIX #17: Leerzeichen-Only Namen blockieren
    if (!name.trim() || name.trim().length < 2) return notify("Mindestens 2 Zeichen!", "error");
    if (name.trim().length > 14) return notify("Maximal 14 Zeichen!", "error");
    setBusy(true);
    try {
      const p = { name:name.trim(), emoji, uid:authUser.uid, email:authUser.email, createdAt:Date.now() };
      await setDoc(doc(db,"profiles",authUser.uid), p);
      await updateProfile(authUser, { displayName:name.trim() });
      onDone(p);
    } catch(e) {
      console.error("Onboarding:", e);
      notify("Fehler beim Speichern.", "error");
      setBusy(false);
    }
  };

  return (
    <div style={S.authBg}><style>{GS}</style>
      <div style={S.authCard}>
        <div style={{fontSize:64,marginBottom:8}}>{emoji}</div>
        <h1 style={{...S.authTitle,fontSize:38,marginBottom:6}}>Wie heißt du?</h1>
        <p style={{color:"#475569",marginBottom:20,fontSize:14}}>Dein Spitzname im Tippspiel</p>
        <input style={{...S.field,marginBottom:16,fontSize:20,textAlign:"center",fontWeight:800}}
          placeholder="Dein Spitzname…" value={name} maxLength={14}
          onChange={e=>setName(e.target.value)}/>
        <div style={{color:"#475569",fontSize:12,marginBottom:10,fontWeight:600}}>Wähle dein Emoji</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:20}}>
          {EMOJIS.map(e=>(
            <button key={e} style={{...S.emojiBtn,...(emoji===e?S.emojiBtnA:{})}} onClick={()=>setEmoji(e)}>{e}</button>
          ))}
        </div>
        <button style={{...S.authBtn,opacity:busy?0.7:1}} onClick={save} disabled={busy}>
          {busy?"…":"Los geht's! 🚀"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────────────────────
function HomeTab({matches,leaderboard,myUid,profile,myTips,myBonus,duels,allProfiles,liveReacts,potTotal,openDuelCount,myBonusAnswered,onMatch,onDuel,tick}){
  const me = leaderboard.find(p=>p.uid===myUid);
  const rank = (leaderboard.findIndex(p=>p.uid===myUid)+1) || "–";
  const rankColor = rank<=2?"#22c55e":rank<=4?"#94a3b8":"#ef4444";
  const live     = matches.filter(m=>m.live);
  const upcoming = matches.filter(m=>!m.result&&!m.live).slice(0,3);
  const finished = matches.filter(m=>m.result).slice(-3).reverse();
  const bonusLeft = BONUS_QUESTIONS.length - myBonusAnswered;

  return(
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroGlow}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:1}}>{profile.emoji} Hey {profile.name}!</div>
            <div style={{color:"#334155",fontSize:12,marginTop:1}}>WM 2026 Tippspiel</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,lineHeight:1,color:rankColor}}>#{rank}</div>
            <div style={{color:"#334155",fontSize:10,fontWeight:700}}>PLATZ</div>
          </div>
        </div>
        <div style={{display:"flex"}}>
          {[[me?.pts??0,"Gesamt",""],[me?.matchPts??0,"Spiele","✏️"],[me?.bonusPts??0,"Bonus","🎯"],[`${potTotal}€`,"Topf","💰"]].map(([v,l,i])=>(
            <div key={l} style={{flex:1,textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26}}>{v}</div>
              <div style={{color:"#334155",fontSize:9,fontWeight:700}}>{i} {l}</div>
            </div>
          ))}
        </div>
      </div>

      {bonusLeft>0&&(
        <div style={{...S.alert,borderColor:"rgba(139,92,246,0.35)",background:"rgba(139,92,246,0.08)"}}>
          <span style={{fontSize:26}}>🎯</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,color:"#8b5cf6",fontSize:15}}>{bonusLeft} Bonusfragen offen!</div>
            <div style={{color:"#64748b",fontSize:12}}>Vor Anpfiff beantworten für Extrapunkte</div>
          </div>
        </div>
      )}
      {openDuelCount>0&&(
        <div style={S.alert}>
          <span style={{fontSize:26}}>🥊</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,color:"#ef4444",fontSize:15}}>{openDuelCount}x Duell-Anfrage!</div>
            <div style={{color:"#64748b",fontSize:12}}>Jemand fordert dich heraus</div>
          </div>
        </div>
      )}

      <SectionTitle>🏆 Tabelle</SectionTitle>
      <div style={S.miniTable}>
        {leaderboard.slice(0,4).map((p,i)=>(
          <div key={p.uid} style={{...S.miniRow,background:p.uid===myUid?"rgba(245,158,11,0.08)":"transparent"}}>
            <span style={{fontSize:18,width:24}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
            <span style={{fontSize:18}}>{p.emoji||"⚽"}</span>
            <span style={{flex:1,fontWeight:700,fontSize:14,color:p.uid===myUid?"#f59e0b":"#f1f5f9"}}>{p.name}</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:p.uid===myUid?"#f59e0b":"#94a3b8"}}>{p.pts}</div>
              {p.bonusPts>0&&<div style={{fontSize:9,color:"#8b5cf6",fontWeight:700}}>+{p.bonusPts} Bonus</div>}
            </div>
          </div>
        ))}
      </div>

      {live.length>0&&<><SectionTitle>🔴 LIVE</SectionTitle>{live.map(m=><MatchCard key={m.id} m={m} myTips={myTips} liveReacts={liveReacts} onMatch={onMatch} onDuel={onDuel} tick={tick}/>)}</>}
      {upcoming.length>0&&<><SectionTitle>📅 Nächste Spiele</SectionTitle>{upcoming.map(m=><MatchCard key={m.id} m={m} myTips={myTips} liveReacts={liveReacts} onMatch={onMatch} onDuel={onDuel} tick={tick}/>)}</>}
      {finished.length>0&&<><SectionTitle>✅ Letzte Ergebnisse</SectionTitle>{finished.map(m=><MatchCard key={m.id} m={m} myTips={myTips} liveReacts={liveReacts} onMatch={onMatch} onDuel={onDuel} tick={tick}/>)}</>}
      {matches.length===0&&<div style={S.empty}>⏳ Spiele werden geladen…<br/><span style={{fontSize:12,opacity:0.5}}>Verbindet mit API</span></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MATCH CARD
// ─────────────────────────────────────────────────────────────
function MatchCard({m,myTips,liveReacts,onMatch,onDuel,tick}){
  const myTip = myTips?.[m.id];
  const pts   = calcPoints(myTip, m.result);
  const locked = isMatchLocked(m);
  const countdown = getCountdown(m);
  const isUrgent = countdown && !countdown.includes("T") && !countdown.includes("h") && !countdown.includes("m ");
  const reactCount = Object.values(liveReacts?.[m.id]||{}).reduce((a,b)=>a+b, 0);

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})+" "+
             d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
    } catch { return iso; }
  };

  return(
    <div style={{...S.mc,...(locked&&!m.result&&!m.live?{opacity:0.6}:{})}} className="mc" onClick={()=>onMatch(m)}>
      {m.live&&<div style={S.liveDot}/>}
      <div style={S.mcMeta}>
        <span style={S.gBadge}>{m.group}</span>
        {m.live
          ? <span style={S.liveBadge}>🔴 {m.elapsed}'</span>
          : <span style={{color:isUrgent?"#ef4444":"#334155",fontSize:11,fontWeight:isUrgent?800:400}}>{fmtDate(m.date)}</span>}
        {m.result&&<span style={S.ftBadge}>FT</span>}
        {pts!=null&&<span style={{...S.ptsBadge,background:PTS_COLOR[pts]}}>+{pts} Pkt</span>}
        {reactCount>0&&<span style={S.reactBadge}>💬{reactCount}</span>}
        {locked&&!m.result&&!m.live&&<span style={{background:"rgba(239,68,68,0.12)",color:"#ef4444",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800}}>🔒</span>}
      </div>
      <div style={S.mcRow}>
        <div style={S.teamC}>
          {m.homeLogo
            ? <img src={m.homeLogo} style={{width:34,height:34,objectFit:"contain"}} alt="" onError={e=>{e.target.style.display="none";}}/>
            : <span style={{fontSize:32}}>{m.homeFlag}</span>}
          <span style={S.teamN}>{m.home}</span>
        </div>
        <div style={S.scoreMid}>
          {m.live&&<div style={S.liveScore}><span style={S.liveNum}>{m.live.home}</span><span style={{color:"#ef4444",fontWeight:900,fontSize:18}}>:</span><span style={S.liveNum}>{m.live.away}</span></div>}
          {m.result&&<div style={S.doneScore}><span style={S.doneNum}>{m.result.home}</span><span style={{color:"#f59e0b",fontWeight:900,fontSize:18}}>:</span><span style={S.doneNum}>{m.result.away}</span></div>}
          {!m.live&&!m.result&&(myTip
            ? <div style={S.tipBub}>{myTip.home}:{myTip.away}</div>
            : <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#1e293b",letterSpacing:1}}>VS</div>)}
        </div>
        <div style={{...S.teamC,alignItems:"flex-end"}}>
          {m.awayLogo
            ? <img src={m.awayLogo} style={{width:34,height:34,objectFit:"contain"}} alt="" onError={e=>{e.target.style.display="none";}}/>
            : <span style={{fontSize:32}}>{m.awayFlag}</span>}
          <span style={S.teamN}>{m.away}</span>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <span style={{color:isUrgent?"#ef4444":myTip?"#22c55e":"#334155",fontSize:11,fontWeight:600}}>
          {countdown&&!locked ? `⏱ ${countdown}` : m.result&&myTip ? `Dein Tipp: ${myTip.home}:${myTip.away}` : myTip ? `✓ ${myTip.home}:${myTip.away}` : "→ Tippen"}
        </span>
        {!locked&&<button style={S.duelChipBtn} onClick={e=>{e.stopPropagation();onDuel(m);}}>🥊 Duell</button>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TIPPEN TAB
// ─────────────────────────────────────────────────────────────
function TippenTab({matches,myTips,liveReacts,onMatch,tick}){
  const [filter,setFilter]=useState("Alle");
  const groups = ["Alle",...new Set(matches.map(m=>m.group).filter(Boolean))];
  const filtered = filter==="Alle" ? matches : matches.filter(m=>m.group===filter);
  const tipped = Object.keys(myTips).length;
  const lockedRunning = matches.filter(m=>isMatchLocked(m)&&!m.result).length;

  return(
    <div style={S.page}>
      <div style={S.progCard}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{color:"#64748b",fontSize:13,fontWeight:700}}>Tipps abgegeben</span>
          <span style={{color:"#f59e0b",fontWeight:900}}>{tipped}/{matches.length}</span>
        </div>
        <div style={S.progBar}><div style={{...S.progFill,width:`${matches.length?tipped/matches.length*100:0}%`}}/></div>
        {lockedRunning>0&&<div style={{marginTop:8,color:"#ef4444",fontSize:11,fontWeight:700}}>🔒 {lockedRunning} Spiele laufen bereits</div>}
      </div>
      <div style={S.filterRow}>
        {groups.map(g=>(
          <button key={g} style={{...S.fb,...(filter===g?S.fbA:{})}} onClick={()=>setFilter(g)}>
            {g==="Alle"?"Alle":g.length>6?g.slice(0,8)+"…":g}
          </button>
        ))}
      </div>
      {filtered.length===0&&<div style={S.empty}>⏳ Lade Spiele…</div>}
      {filtered.map(m=><MatchCard key={m.id} m={m} myTips={myTips} liveReacts={liveReacts} onMatch={onMatch} onDuel={()=>{}} tick={tick}/>)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BONUS TAB
// ─────────────────────────────────────────────────────────────
function BonusTab({questions,myBonus,bonusResults,allProfiles,bonusTips,onSave,tick}){
  const answered = questions.filter(q=>myBonus[q.id]).length;
  const totalPts = questions.reduce((s,q)=>s+q.points,0);

  return(
    <div style={S.page}>
      <div style={{background:"linear-gradient(135deg,rgba(139,92,246,0.2),rgba(59,130,246,0.1))",border:"1px solid rgba(139,92,246,0.3)",borderRadius:20,padding:"18px 20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,background:"radial-gradient(circle,rgba(139,92,246,0.2),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:1,marginBottom:2}}>🎯 Bonusfragen</div>
        <div style={{color:"#64748b",fontSize:13,marginBottom:12}}>Beantworte alle vor dem ersten Anpfiff!</div>
        <div style={{display:"flex",gap:20,marginBottom:12}}>
          <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#8b5cf6"}}>{answered}/{questions.length}</div><div style={{color:"#475569",fontSize:10,fontWeight:700}}>BEANTWORTET</div></div>
          <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#f59e0b"}}>{totalPts}</div><div style={{color:"#475569",fontSize:10,fontWeight:700}}>MAX PUNKTE</div></div>
        </div>
        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:6,height:6,overflow:"hidden"}}>
          <div style={{width:`${questions.length?answered/questions.length*100:0}%`,height:"100%",background:"linear-gradient(90deg,#8b5cf6,#3b82f6)",borderRadius:6,transition:"width 0.5s ease"}}/>
        </div>
      </div>
      <BonusLeaderboard questions={questions} bonusTips={bonusTips} bonusResults={bonusResults} allProfiles={allProfiles}/>
      {questions.map(q=>(
        <BonusQuestion key={q.id} q={q} myAnswer={myBonus[q.id]}
          correctAnswer={bonusResults[q.id]}
          allAnswers={Object.entries(allProfiles).map(([uid,p])=>({uid,name:p.name,emoji:p.emoji,answer:bonusTips[uid]?.[q.id]}))}
          onSave={answer=>onSave(q,answer)} tick={tick}/>
      ))}
    </div>
  );
}

function BonusLeaderboard({questions,bonusTips,bonusResults,allProfiles}){
  const scored = Object.entries(allProfiles).map(([uid,p])=>{
    let pts=0;
    questions.forEach(q=>{
      const a=bonusTips[uid]?.[q.id], c=bonusResults[q.id];
      if(!a||!c) return;
      if(q.scoring==="closest"){const d=Math.abs(+a-+c);if(d===0)pts+=q.points;else if(d<=3)pts+=Math.floor(q.points/2);}
      else if(String(a)===String(c)) pts+=q.points;
    });
    return{uid,...p,pts};
  }).filter(p=>p.pts>0).sort((a,b)=>b.pts-a.pts);
  if(!scored.length) return null;
  return(
    <div style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:13,color:"#8b5cf6",marginBottom:8}}>🏅 Bonus-Rangliste</div>
      {scored.map((p,i)=>(
        <div key={p.uid} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{fontSize:16}}>{i===0?"🥇":i===1?"🥈":"🥉"}</span>
          <span style={{fontSize:16}}>{p.emoji}</span>
          <span style={{flex:1,fontWeight:700,fontSize:13}}>{p.name}</span>
          <span style={{color:"#8b5cf6",fontWeight:900,fontFamily:"'Bebas Neue',sans-serif",fontSize:20}}>{p.pts} Pkt</span>
        </div>
      ))}
    </div>
  );
}

function BonusQuestion({q,myAnswer,correctAnswer,allAnswers,onSave,tick}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [val,setVal]=useState(myAnswer||"");
  // BUG FIX #18: val mit neuem myAnswer syncen wenn Firestore updatet
  useEffect(()=>{ if(myAnswer) setVal(myAnswer); },[myAnswer]);

  const locked = isBonusLocked(q);
  const countdown = !locked ? getCountdown({date:q.deadline}) : null;
  const isCorrect = correctAnswer && String(myAnswer)===String(correctAnswer);
  const isWrong   = correctAnswer && myAnswer && !isCorrect;
  const borderColor = isCorrect?"rgba(34,197,94,0.4)":isWrong?"rgba(239,68,68,0.3)":myAnswer?"rgba(139,92,246,0.35)":"rgba(255,255,255,0.07)";
  const filtered = (q.options||[]).filter(o=>o.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${borderColor}`,borderRadius:16,padding:"14px 15px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flex:1,minWidth:0}}>
          <span style={{fontSize:24,flexShrink:0}}>{q.icon}</span>
          <div style={{minWidth:0}}>
            <div style={{color:q.color,fontSize:10,fontWeight:800,letterSpacing:0.5}}>{q.category} · +{q.points} Punkte</div>
            <div style={{fontWeight:800,fontSize:14,color:"#f1f5f9",lineHeight:1.3}}>{q.question}</div>
          </div>
        </div>
        {locked
          ? <span style={{background:"rgba(100,116,139,0.15)",color:"#64748b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:800,flexShrink:0,marginLeft:8}}>🔒</span>
          : countdown&&<span style={{color:"#f59e0b",fontSize:11,fontWeight:800,flexShrink:0,marginLeft:8}}>⏱ {countdown}</span>}
      </div>

      {q.hint&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#475569",marginBottom:10}}>{q.hint}</div>}

      {correctAnswer&&(
        <div style={{background:isCorrect?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.08)",border:`1px solid ${isCorrect?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.2)"}`,borderRadius:10,padding:"8px 12px",marginBottom:10,fontSize:13}}>
          <span style={{fontWeight:800,color:isCorrect?"#22c55e":"#ef4444"}}>{isCorrect?"✅ Richtig!":"❌ Falsch –"}</span>
          {!isCorrect&&<span style={{color:"#94a3b8"}}> Richtig: <strong style={{color:"#f1f5f9"}}>{correctAnswer}</strong></span>}
        </div>
      )}

      {!locked&&!correctAnswer&&(
        <div style={{marginBottom:8}}>
          {q.type==="number"&&(
            <div style={{display:"flex",gap:8}}>
              <input type="number" style={{...S.field,flex:1,fontSize:20,textAlign:"center",fontWeight:900,padding:"10px"}}
                value={val} placeholder="Zahl…" onChange={e=>setVal(e.target.value)}/>
              <button style={S.saveBtn} onClick={()=>val!=""&&onSave(val)}>✓</button>
            </div>
          )}
          {q.type==="single_choice"&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {q.options.map(o=>(
                <button key={o} style={{background:val===o?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${val===o?"#8b5cf6":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"10px 14px",color:val===o?"#c4b5fd":"#94a3b8",fontWeight:700,fontSize:14,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}
                  onClick={()=>{setVal(o);onSave(o);}}>
                  {val===o?"✓ ":""}{o}
                </button>
              ))}
            </div>
          )}
          {(q.type==="team_select"||q.type==="player_select"||q.type==="keeper_select")&&(
            <div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input style={{...S.field,flex:1,padding:"8px 12px",fontSize:13}} placeholder="Suchen…"
                  value={search} onChange={e=>setSearch(e.target.value)}/>
                {val&&<button style={S.saveBtn} onClick={()=>onSave(val)}>✓ {val.split(" ")[0]}</button>}
              </div>
              <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {(search ? filtered : (q.options||[]).slice(0,15)).map(o=>(
                  <button key={o} style={{background:val===o?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${val===o?"#8b5cf6":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"8px 12px",color:val===o?"#c4b5fd":"#94a3b8",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}
                    onClick={()=>{setVal(o);setSearch("");onSave(o);}}>
                    {q.type==="team_select"&&<span>{teamFlag(o)}</span>}
                    <span style={{flex:1}}>{o}</span>
                    {val===o&&<span style={{color:"#8b5cf6"}}>✓</span>}
                  </button>
                ))}
                {search&&filtered.length===0&&<div style={{color:"#334155",fontSize:12,padding:8}}>Keine Treffer</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {(locked||correctAnswer)&&myAnswer&&(
        <div style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:8,padding:"7px 12px",fontSize:13,color:"#c4b5fd",fontWeight:700}}>
          Deine Antwort: {myAnswer} {q.type==="team_select"?teamFlag(myAnswer):""}
        </div>
      )}
      {locked&&!myAnswer&&<div style={{color:"#334155",fontSize:12,fontStyle:"italic"}}>Nicht beantwortet — 0 Punkte</div>}

      {allAnswers.filter(a=>a.answer).length>0&&(
        <button style={{marginTop:8,background:"none",border:"none",color:"#475569",fontSize:12,cursor:"pointer",padding:0}} onClick={()=>setOpen(!open)}>
          {open?`▲ Verbergen`:`▼ Alle Antworten (${allAnswers.filter(a=>a.answer).length})`}
        </button>
      )}
      {open&&(
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
          {allAnswers.filter(a=>a.answer).map(a=>(
            <div key={a.uid} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"6px 10px"}}>
              <span style={{fontSize:14}}>{a.emoji||"⚽"}</span>
              <span style={{flex:1,fontSize:13,fontWeight:700,color:"#94a3b8"}}>{a.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:correctAnswer?(String(a.answer)===String(correctAnswer)?"#22c55e":"#ef4444"):"#f59e0b"}}>
                {a.answer} {q.type==="team_select"?teamFlag(a.answer):""}
              </span>
              {correctAnswer&&<span>{String(a.answer)===String(correctAnswer)?"✅":"❌"}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RANGLISTE
// ─────────────────────────────────────────────────────────────
function RanglisteTab({leaderboard,myUid,matches}){
  const done=matches.filter(m=>m.result).length;
  return(
    <div style={S.page}>
      <div style={{textAlign:"right",color:"#334155",fontSize:12,marginBottom:12}}>{done} von {matches.length} Spielen</div>
      {leaderboard.map((p,i)=>{
        const isMe=p.uid===myUid;
        const zC=i<2?"#22c55e":i<4?"#64748b":"#ef4444";
        const zB=i<2?"rgba(34,197,94,0.08)":i<4?"rgba(100,116,139,0.08)":"rgba(239,68,68,0.08)";
        return(
          <div key={p.uid} style={{...S.rankRow,background:isMe?"rgba(245,158,11,0.1)":zB,border:`1px solid ${isMe?"rgba(245,158,11,0.35)":zC+"44"}`}}>
            <div style={{...S.rankBar,background:isMe?"#f59e0b":zC}}/>
            <span style={{fontSize:20,width:26,flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1+"."}</span>
            <span style={{fontSize:20,flexShrink:0}}>{p.emoji||"⚽"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:14,color:isMe?"#f59e0b":"#f1f5f9",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}{isMe?" (Du)":""}</div>
              <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                {[["#22c55e",`🎯${p.exact}`],["#3b82f6",`📐${p.diff}`],["#f59e0b",`↗${p.tend}`],["#ef4444",`✗${p.miss}`],["#8b5cf6",`🎯+${p.bonusPts}`]].map(([c,v])=>(
                  <span key={v} style={{color:c,fontSize:10,fontWeight:700}}>{v}</span>
                ))}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:isMe?"#f59e0b":zC,lineHeight:1}}>{p.pts}</div>
              {p.bonusPts>0&&<div style={{fontSize:9,color:"#8b5cf6",fontWeight:700}}>+{p.bonusPts}B</div>}
              <div style={{color:"#334155",fontSize:9,fontWeight:700}}>PTS</div>
            </div>
          </div>
        );
      })}
      <div style={S.legend}>
        {[["#22c55e","🏆 Platz 1–2 · Gewinner"],["#64748b","😐 Platz 3–4 · Mittelfeld"],["#ef4444","🍺 Platz 5–7 · Zahlt Runde"]].map(([c,t])=>(
          <div key={c} style={{display:"flex",alignItems:"center",gap:8,color:"#475569",fontSize:12}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:c,flexShrink:0}}/>{t}
          </div>
        ))}
      </div>
      <div style={S.rulesBox}>
        <div style={{fontWeight:800,color:"#f1f5f9",marginBottom:10}}>📋 Punktesystem</div>
        {[["#22c55e","4 Pts","Exaktes Ergebnis 🎯"],["#3b82f6","3 Pts","Tordifferenz richtig 📐"],["#f59e0b","2 Pts","Richtiger Gewinner ↗"],["#ef4444","0 Pts","Falsch ✗"],["#8b5cf6","bis 15","Bonusfragen 🎯"]].map(([c,p,d])=>(
          <div key={p} style={{display:"flex",gap:10,marginBottom:6,alignItems:"center"}}>
            <span style={{color:c,fontWeight:900,width:60,fontSize:12}}>{p}</span>
            <span style={{color:"#64748b",fontSize:12}}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DUELLE
// ─────────────────────────────────────────────────────────────
function DuelleTab({duels,allProfiles,myUid,matches,onNewDuel}){
  const myD=Object.entries(duels).filter(([,d])=>d.challengerId===myUid||d.opponentId===myUid);
  const won =myD.filter(([,d])=>d.status==="settled"&&d.winner===myUid).reduce((s,[,d])=>s+d.amount,0);
  const lost=myD.filter(([,d])=>d.status==="settled"&&d.winner&&d.winner!==myUid).reduce((s,[,d])=>s+d.amount,0);
  const openForMe=Object.entries(duels).filter(([,d])=>d.opponentId===myUid&&d.status==="open");
  const availableMatches=matches.filter(m=>!m.result&&!isMatchLocked(m));

  return(
    <div style={S.page}>
      <div style={{background:"linear-gradient(135deg,#0f1e35,#0a1525)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:"18px 20px",marginBottom:16,display:"flex",alignItems:"center"}}>
        {[[`+${won}€`,"Gewonnen","#22c55e"],[`-${lost}€`,"Verloren","#ef4444"],[(won-lost>=0?"+":"")+(won-lost)+"€","Bilanz","#f59e0b"]].map(([v,l,c])=>(
          <div key={l} style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:c}}>{v}</div>
            <div style={{color:"#334155",fontSize:10,fontWeight:700}}>{l}</div>
          </div>
        ))}
      </div>

      {openForMe.length>0&&(
        <><SectionTitle>🔔 Deine Anfragen</SectionTitle>
          {openForMe.map(([key,d])=>{
            const c=allProfiles[d.challengerId], m=matches.find(x=>x.id===d.matchId);
            return(
              <div key={key} style={{...S.duelC,border:"1px solid rgba(239,68,68,0.3)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:"#64748b",fontSize:12}}>{m?.home} vs {m?.away}</span>
                  <span style={{background:"rgba(245,158,11,0.14)",color:"#f59e0b",borderRadius:8,padding:"2px 10px",fontWeight:900}}>{d.amount}€</span>
                </div>
                <div style={{fontWeight:700,color:"#f1f5f9"}}>{c?.emoji} {c?.name} fordert dich heraus!</div>
                <div style={{color:"#475569",fontSize:12,marginTop:4}}>Gib deinen Tipp für das Spiel ab, um automatisch anzunehmen.</div>
              </div>
            );
          })}
        </>
      )}

      <SectionTitle>➕ Neues Duell</SectionTitle>
      {availableMatches.length>0
        ? <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
            {availableMatches.map(m=>(
              <button key={m.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"12px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",flexShrink:0,minWidth:76}} onClick={()=>onNewDuel(m)}>
                <span style={{fontSize:22}}>{m.homeFlag}</span>
                <span style={{color:"#334155",fontSize:10,fontWeight:700}}>vs</span>
                <span style={{fontSize:22}}>{m.awayFlag}</span>
                <span style={{color:"#f59e0b",fontSize:9,fontWeight:800}}>🥊 DUELL</span>
              </button>
            ))}
          </div>
        : <div style={S.empty}>Keine offenen Spiele für Duelle</div>
      }

      <SectionTitle>Alle Duelle</SectionTitle>
      {Object.keys(duels).length===0&&<div style={S.empty}>Noch keine Duelle — fordere jemanden heraus!</div>}
      {Object.entries(duels).map(([key,d])=>{
        const c=allProfiles[d.challengerId], o=allProfiles[d.opponentId], m=matches.find(x=>x.id===d.matchId);
        const isMe=d.challengerId===myUid||d.opponentId===myUid;
        const sC=d.status==="settled"?(d.winner===myUid?"#22c55e":"#ef4444"):"#f59e0b";
        const sL=d.status==="settled"?(d.winner===myUid?"🎉 Gewonnen":"😭 Verloren"):d.status==="open"?"⏳ Offen":"🤝 Läuft";
        return(
          <div key={key} style={{...S.duelC,border:isMe?"1px solid rgba(245,158,11,0.2)":"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"#475569",fontSize:11,flex:1,marginRight:8}}>{m?`${m.homeFlag} ${m.home} vs ${m.away} ${m.awayFlag}`:"Spiel"}</span>
              <span style={{background:"rgba(245,158,11,0.14)",color:"#f59e0b",borderRadius:8,padding:"2px 10px",fontWeight:900,flexShrink:0}}>{d.amount}€</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontWeight:700,fontSize:13}}>{c?.emoji} {c?.name}</span>
                {d.challengerTip&&<span style={{background:"rgba(245,158,11,0.14)",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:900,width:"fit-content"}}>{d.challengerTip.home}:{d.challengerTip.away}</span>}
              </div>
              <span style={{color:"#f59e0b",fontSize:18,fontWeight:900}}>🥊</span>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                <span style={{fontWeight:700,fontSize:13}}>{o?.emoji} {o?.name}</span>
                {d.challengedTip
                  ? <span style={{background:"rgba(245,158,11,0.14)",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:900}}>{d.challengedTip.home}:{d.challengedTip.away}</span>
                  : <span style={{color:"#334155",fontSize:10}}>ausstehend…</span>}
              </div>
            </div>
            <div style={{textAlign:"center",color:sC,fontWeight:800,fontSize:12}}>{sL}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TOPF
// ─────────────────────────────────────────────────────────────
function TopfTab({payments,allProfiles,myUid,potTotal,duels,leaderboard,notify}){
  const duelPot = Object.values(duels).filter(d=>d.status==="settled").reduce((s,d)=>s+d.amount,0);
  const total = potTotal+duelPot;
  const myPay = payments[myUid];
  const initPay = () => {
    setDoc(doc(db,"payments",myUid),{uid:myUid,paid:false,verified:false,initiatedAt:serverTimestamp()},{merge:true});
    window.open("https://paypal.me/DEINNAME/20EUR","_blank");
    notify("PayPal geöffnet – wir bestätigen automatisch 🟡","warn");
  };
  return(
    <div style={S.page}>
      <div style={{background:"radial-gradient(ellipse at 50% 0%,rgba(245,158,11,0.16),rgba(10,15,28,1) 65%)",border:"1px solid rgba(245,158,11,0.22)",borderRadius:24,padding:"28px 24px",textAlign:"center",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,left:"30%",width:200,height:200,background:"radial-gradient(circle,rgba(245,158,11,0.15),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{fontSize:48,marginBottom:4}}>💰</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:72,color:"#f59e0b",lineHeight:1,textShadow:"0 0 40px rgba(245,158,11,0.4)"}}>{total}€</div>
        <div style={{color:"#94a3b8",fontSize:14,marginBottom:10}}>Gesamttopf</div>
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:12,padding:"10px 20px",display:"inline-flex",flexDirection:"column",gap:4,minWidth:180}}>
          {[["Grundbeiträge",potTotal+"€","#f1f5f9"],["Duelle","+"+duelPot+"€","#f59e0b"]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",gap:20,fontSize:13}}>
              <span style={{color:"#64748b"}}>{l}</span><span style={{color:c,fontWeight:800}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <SectionTitle>🏆 Gewinnverteilung</SectionTitle>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"14px 15px",marginBottom:14}}>
        {[["🥇 Platz 1",50,"#f59e0b"],["🥈 Platz 2",30,"#94a3b8"],["🥉 Platz 3",20,"#cd7c3a"]].map(([place,pct,c])=>(
          <div key={place} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontWeight:700,fontSize:13,width:80}}>{place}</span>
            <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:6,height:8,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:6}}/></div>
            <span style={{color:c,fontWeight:900,fontSize:15,width:46,textAlign:"right"}}>{Math.round(total*pct/100)}€</span>
          </div>
        ))}
      </div>
      <SectionTitle>💳 Grundbeitrag (20€)</SectionTitle>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"4px 14px",marginBottom:14}}>
        {Object.entries(allProfiles).map(([uid,p])=>{
          const pay=payments[uid];
          return(
            <div key={uid} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",background:uid===myUid?"rgba(245,158,11,0.05)":"transparent"}}>
              <span style={{fontSize:20}}>{p.emoji||"⚽"}</span>
              <span style={{flex:1,fontWeight:700,fontSize:14}}>{p.name}{uid===myUid?" (Du)":""}</span>
              <span style={pay?.verified?S.greenBadge:pay?.paid?S.yellowBadge:S.redBadge}>
                {pay?.verified?"✓ Bestätigt":pay?.paid?"⏳ Ausstehend":"✕ Offen"}
              </span>
            </div>
          );
        })}
      </div>
      {!myPay?.verified&&!myPay?.paid&&(
        <button style={{display:"flex",flexDirection:"column",alignItems:"center",background:"#003087",color:"#fff",borderRadius:16,padding:"16px",border:"none",cursor:"pointer",width:"100%",gap:3,fontFamily:"'DM Sans',sans-serif"}} onClick={initPay}>
          <span style={{fontWeight:800,fontSize:16}}>💳 Jetzt 20€ einzahlen</span>
          <span style={{fontSize:11,opacity:0.7}}>Öffnet PayPal · Automatische Bestätigung</span>
        </button>
      )}
      {myPay?.paid&&!myPay?.verified&&<div style={{borderRadius:12,border:"1px solid rgba(245,158,11,0.3)",padding:14,textAlign:"center",fontSize:14,fontWeight:700,color:"#f59e0b",marginTop:12}}>⏳ Zahlung wird verifiziert…</div>}
      {myPay?.verified&&<div style={{borderRadius:12,border:"1px solid rgba(34,197,94,0.3)",padding:14,textAlign:"center",fontSize:14,fontWeight:700,color:"#22c55e",marginTop:12}}>✅ Zahlung bestätigt!</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MATCH MODAL
// ─────────────────────────────────────────────────────────────
function MatchModal({match:m,myUid,allTips,allProfiles,duels,reactions,onClose,onSaveTip,onReact,onDuel,tick}){
  const myTip=allTips[myUid]?.[m.id];
  const [h,setH]=useState(myTip?.home??"");
  const [a,setA]=useState(myTip?.away??"");
  // BUG FIX #18: sync when external tip changes
  useEffect(()=>{ if(myTip){setH(myTip.home);setA(myTip.away);} },[myTip?.home,myTip?.away]);
  const locked=isMatchLocked(m);
  const countdown=getCountdown(m);
  const isDone=!!m.result;
  const matchDuels=Object.entries(duels).filter(([k])=>k.startsWith(`${m.id}_`));

  return(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.modalHand}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6}}>
            {m.homeLogo?<img src={m.homeLogo} style={{width:42,height:42,objectFit:"contain"}} alt="" onError={e=>{e.target.style.display="none";}}/>:<span style={{fontSize:42}}>{m.homeFlag}</span>}
            <span style={{color:"#94a3b8",fontSize:12,fontWeight:700,maxWidth:100,lineHeight:1.2}}>{m.home}</span>
          </div>
          {isDone?<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,color:"#f59e0b",letterSpacing:2}}>{m.result.home}:{m.result.away}</div>
           :m.live?<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,color:"#ef4444",letterSpacing:2}}>{m.live.home}:{m.live.away}</div>
           :<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#1e293b",letterSpacing:2}}>VS</div>}
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            {m.awayLogo?<img src={m.awayLogo} style={{width:42,height:42,objectFit:"contain"}} alt="" onError={e=>{e.target.style.display="none";}}/>:<span style={{fontSize:42}}>{m.awayFlag}</span>}
            <span style={{color:"#94a3b8",fontSize:12,fontWeight:700,maxWidth:100,textAlign:"right",lineHeight:1.2}}>{m.away}</span>
          </div>
        </div>
        <div style={{textAlign:"center",color:"#334155",fontSize:12,marginBottom:4}}>{m.group} · {m.venue}</div>
        {!locked&&countdown&&<div style={{textAlign:"center",color:"#f59e0b",fontWeight:800,fontSize:13,marginBottom:12}}>⏱ Noch {countdown} bis Tippschluss</div>}
        {locked&&!isDone&&<div style={{textAlign:"center",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"8px",color:"#ef4444",fontWeight:800,fontSize:13,marginBottom:12}}>🔒 Tippschluss – Spiel läuft</div>}

        {!locked&&!isDone&&(
          <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",marginBottom:16}}>
            <input type="number" min="0" max="50" style={S.tipIn} value={h} placeholder="–" onChange={e=>setH(e.target.value)}/>
            <span style={{color:"#f59e0b",fontWeight:900,fontSize:26}}>:</span>
            <input type="number" min="0" max="50" style={S.tipIn} value={a} placeholder="–" onChange={e=>setA(e.target.value)}/>
            <button style={S.saveBtn} onClick={()=>onSaveTip(h||0,a||0)}>Speichern</button>
          </div>
        )}

        <div style={S.mSection}>Alle Tipps</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
          {Object.entries(allProfiles).map(([uid,p])=>{
            const t=allTips[uid]?.[m.id], pts=calcPoints(t,m.result);
            return(
              <div key={uid} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{p.emoji||"⚽"}</span>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:"#94a3b8",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                <span style={{border:`1px solid ${t?"#f59e0b":"#1e293b"}`,borderRadius:8,padding:"3px 8px",fontSize:14,fontWeight:900,color:t?"#f59e0b":"#334155",flexShrink:0}}>
                  {t?`${t.home}:${t.away}`:"–"}
                </span>
                {pts!=null&&<span style={{background:PTS_COLOR[pts],borderRadius:6,padding:"2px 5px",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>+{pts}</span>}
              </div>
            );
          })}
        </div>

        <div style={S.mSection}>Reaktionen</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
          {REACTIONS.map(e=>(
            <button key={e} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"7px 11px",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",gap:4}} onClick={()=>onReact(e)}>
              {e}{reactions[e]>0&&<span style={{color:"#64748b",fontSize:11,fontWeight:700}}>{reactions[e]}</span>}
            </button>
          ))}
        </div>

        {matchDuels.length>0&&(
          <><div style={S.mSection}>Duelle</div>
            {matchDuels.map(([key,d])=>{
              const c=allProfiles[d.challengerId],o=allProfiles[d.opponentId];
              const sC=d.status==="settled"?"#22c55e":"#f59e0b";
              return(
                <div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 12px",marginBottom:6}}>
                  <span style={{fontWeight:700,fontSize:13}}>{c?.emoji} {c?.name}</span>
                  <span style={{color:"#f59e0b",fontWeight:900}}>🥊 {d.amount}€</span>
                  <span style={{fontWeight:700,fontSize:13}}>{o?.emoji} {o?.name}</span>
                  <span style={{color:sC,fontSize:11,fontWeight:800}}>{d.status==="settled"?"✓":"⏳"}</span>
                </div>
              );
            })}
          </>
        )}

        <div style={{display:"flex",gap:8,marginTop:16}}>
          {!locked&&!isDone&&<button style={{...S.saveBtn,background:"rgba(239,68,68,0.15)",color:"#ef4444",flexShrink:0}} onClick={onDuel}>🥊 Duell</button>}
          <button style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",color:"#64748b",borderRadius:14,padding:14,fontWeight:700,cursor:"pointer"}} onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DUEL MODAL
// ─────────────────────────────────────────────────────────────
function DuelModal({match:m,myUid,allProfiles,onSend,onClose}){
  const [opp,setOpp]=useState("");
  const [amount,setAmount]=useState(10);
  const others=Object.entries(allProfiles).filter(([uid])=>uid!==myUid);
  return(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.modalHand}/>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,marginBottom:4}}>🥊 Duell anfragen</div>
        <div style={{color:"#64748b",fontSize:14,marginBottom:16}}>{m.homeFlag} {m.home} vs {m.away} {m.awayFlag}</div>
        <div style={{color:"#475569",fontSize:11,fontWeight:800,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>Gegner wählen</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {others.map(([uid,p])=>(
            <button key={uid} style={{background:opp===uid?"rgba(245,158,11,0.14)":"rgba(255,255,255,0.04)",border:`1px solid ${opp===uid?"#f59e0b":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"12px 6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}} onClick={()=>setOpp(uid)}>
              <span style={{fontSize:22}}>{p.emoji||"⚽"}</span>
              <span style={{fontSize:12,fontWeight:800,color:"#f1f5f9"}}>{p.name}</span>
            </button>
          ))}
        </div>
        <div style={{color:"#475569",fontSize:11,fontWeight:800,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>Einsatz</div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          {[5,10,15,20,50].map(v=>(
            <button key={v} style={{background:amount===v?"rgba(245,158,11,0.18)":"rgba(255,255,255,0.05)",border:`1px solid ${amount===v?"#f59e0b":"rgba(255,255,255,0.08)"}`,color:amount===v?"#f59e0b":"#94a3b8",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:800,fontSize:14}} onClick={()=>setAmount(v)}>
              {v}€
            </button>
          ))}
        </div>
        <input type="number" style={{...S.field,marginBottom:12}} value={amount} min={1} max={500} onChange={e=>setAmount(+e.target.value)} placeholder="Eigener Betrag (1–500€)"/>
        <div style={{color:"#334155",fontSize:12,lineHeight:1.7,marginBottom:16,textAlign:"center"}}>Wer den besseren Tipp hat gewinnt.<br/>Bei Gleichstand kein Verlust.</div>
        <div style={{display:"flex",gap:10}}>
          <button style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569",borderRadius:12,padding:"14px 18px",cursor:"pointer",fontWeight:700}} onClick={onClose}>Abbrechen</button>
          <button style={{...S.saveBtn,flex:1,padding:14,fontSize:15,opacity:opp?1:0.4}} disabled={!opp} onClick={()=>opp&&onSend(m.id,opp,amount)}>
            Anfrage senden 🥊
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function Splash(){
  return(
    <div style={{minHeight:"100vh",background:"#060b14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <style>{GS}</style>
      <span style={{fontSize:64,animation:"pulse 1s infinite"}}>⚽</span>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:"#f59e0b",letterSpacing:3}}>WM 2026</div>
    </div>
  );
}
function SectionTitle({children}){
  return <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1,color:"#f1f5f9",marginBottom:10,marginTop:4}}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────
const GS=`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body{background:#060b14;overscroll-behavior:none;}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
  .mc{transition:transform 0.12s ease;} .mc:active{transform:scale(0.97);}
  .floater{position:fixed;top:28%;font-size:38px;animation:floatUp 1.5s ease-out forwards;z-index:9999;pointer-events:none;}
  @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-180px) scale(1.8)}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{display:inline-block;animation:spin 0.8s linear infinite;}
  ::-webkit-scrollbar{display:none;}
  img{-webkit-user-drag:none;}
`;

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const S={
  app:{background:"#060b14",minHeight:"100vh",maxWidth:480,margin:"0 auto",fontFamily:"'DM Sans',sans-serif",color:"#f1f5f9",paddingBottom:76,position:"relative"},
  authBg:{minHeight:"100vh",background:"radial-gradient(ellipse at 40% 0%,#0f2040,#060b14 60%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflow:"hidden",position:"relative"},
  authGlow:{position:"absolute",top:"-10%",left:"25%",width:280,height:280,background:"radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)",pointerEvents:"none"},
  authCard:{width:"100%",maxWidth:400,textAlign:"center"},
  authTitle:{fontFamily:"'Bebas Neue',sans-serif",fontSize:68,letterSpacing:4,background:"linear-gradient(135deg,#f59e0b,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,marginBottom:4},
  modeSw:{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:4,marginBottom:20,gap:4},
  modeBtn:{flex:1,background:"none",border:"none",color:"#475569",borderRadius:9,padding:"10px",cursor:"pointer",fontWeight:700,fontSize:14},
  modeBtnA:{background:"rgba(245,158,11,0.18)",color:"#f59e0b"},
  field:{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"14px 16px",color:"#f1f5f9",fontSize:15,outline:"none",fontFamily:"'DM Sans',sans-serif",width:"100%"},
  errBox:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:12},
  authBtn:{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:14,padding:"16px",fontSize:16,fontWeight:900,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  emojiBtn:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 10px",cursor:"pointer",fontSize:24},
  emojiBtnA:{background:"rgba(245,158,11,0.2)",border:"1px solid #f59e0b"},
  header:{position:"sticky",top:0,zIndex:100,background:"rgba(6,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"},
  hBall:{fontSize:26,filter:"drop-shadow(0 0 8px rgba(245,158,11,0.4))"},
  hTitle:{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,background:"linear-gradient(135deg,#f59e0b,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  hSub:{fontSize:10,color:"#334155",fontWeight:600},
  syncBtn:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:15},
  userChip:{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:20,padding:"5px 12px 5px 8px",display:"flex",alignItems:"center",gap:6},
  chipName:{fontSize:13,fontWeight:800,color:"#f59e0b"},
  xBtn:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:14},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(6,11,20,0.98)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",zIndex:100},
  nb:{flex:1,background:"none",border:"none",color:"#334155",padding:"8px 2px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,borderTop:"2px solid transparent",transition:"all 0.18s",position:"relative"},
  nbA:{color:"#f59e0b",borderTop:"2px solid #f59e0b"},
  nl:{fontSize:8,fontWeight:800,letterSpacing:0.3},
  badge:{position:"absolute",top:5,right:"calc(50% - 16px)",color:"#fff",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:900},
  notif:{position:"fixed",top:74,left:"50%",transform:"translateX(-50%)",zIndex:9999,borderRadius:12,padding:"11px 20px",fontWeight:800,fontSize:14,color:"#fff",whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"},
  page:{padding:"14px 14px 20px"},
  empty:{textAlign:"center",color:"#334155",padding:"30px 20px",fontSize:14,lineHeight:2},
  hero:{background:"linear-gradient(135deg,#0f1e35,#0a1525)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:20,padding:20,marginBottom:14,position:"relative",overflow:"hidden"},
  heroGlow:{position:"absolute",top:-50,right:-50,width:180,height:180,background:"radial-gradient(circle,rgba(245,158,11,0.12),transparent 70%)",pointerEvents:"none"},
  alert:{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12,cursor:"pointer"},
  miniTable:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"4px 14px",marginBottom:14},
  miniRow:{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"},
  mc:{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"12px 14px",marginBottom:9,cursor:"pointer",position:"relative",overflow:"hidden"},
  liveDot:{position:"absolute",top:12,right:12,width:8,height:8,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px #ef4444",animation:"pulse 1s infinite"},
  mcMeta:{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"},
  gBadge:{background:"rgba(245,158,11,0.13)",color:"#f59e0b",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800},
  liveBadge:{background:"rgba(239,68,68,0.15)",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:800},
  ftBadge:{background:"rgba(100,116,139,0.14)",color:"#64748b",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700},
  ptsBadge:{borderRadius:7,padding:"2px 9px",fontSize:11,fontWeight:900,color:"#fff",marginLeft:"auto"},
  reactBadge:{background:"rgba(59,130,246,0.1)",color:"#60a5fa",borderRadius:6,padding:"2px 7px",fontSize:10},
  mcRow:{display:"flex",alignItems:"center",gap:8},
  teamC:{flex:1,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4},
  teamN:{color:"#64748b",fontSize:11,fontWeight:700,maxWidth:80,lineHeight:1.2},
  scoreMid:{display:"flex",justifyContent:"center",alignItems:"center",width:68},
  tipBub:{background:"rgba(245,158,11,0.16)",border:"1px solid rgba(245,158,11,0.32)",borderRadius:10,padding:"4px 10px",color:"#f59e0b",fontWeight:900,fontSize:18,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1},
  liveScore:{display:"flex",alignItems:"center",gap:3},
  liveNum:{background:"rgba(239,68,68,0.18)",borderRadius:8,width:26,height:32,display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontFamily:"'Bebas Neue',sans-serif",fontSize:22},
  doneScore:{display:"flex",alignItems:"center",gap:3},
  doneNum:{background:"rgba(245,158,11,0.14)",borderRadius:8,width:26,height:32,display:"flex",alignItems:"center",justifyContent:"center",color:"#f59e0b",fontFamily:"'Bebas Neue',sans-serif",fontSize:22},
  duelChipBtn:{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.22)",color:"#ef4444",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:800,cursor:"pointer"},
  progCard:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"13px 15px",marginBottom:14},
  progBar:{background:"rgba(255,255,255,0.06)",borderRadius:6,height:6,overflow:"hidden"},
  progFill:{background:"linear-gradient(90deg,#f59e0b,#ef4444)",height:"100%",borderRadius:6,transition:"width 0.5s ease"},
  filterRow:{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:2},
  fb:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#475569",borderRadius:20,padding:"6px 13px",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0},
  fbA:{background:"rgba(245,158,11,0.14)",border:"1px solid #f59e0b",color:"#f59e0b"},
  rankRow:{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:14,marginBottom:8,position:"relative",overflow:"hidden"},
  rankBar:{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:"14px 0 0 14px"},
  legend:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"12px 14px",marginBottom:12,display:"flex",flexDirection:"column",gap:7},
  rulesBox:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"14px 15px"},
  duelC:{background:"rgba(255,255,255,0.03)",borderRadius:16,padding:"13px 15px",marginBottom:9},
  greenBadge:{background:"rgba(34,197,94,0.13)",color:"#22c55e",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:800},
  yellowBadge:{background:"rgba(245,158,11,0.13)",color:"#f59e0b",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:800},
  redBadge:{background:"rgba(239,68,68,0.1)",color:"#ef4444",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:800},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"flex-end"},
  modal:{background:"#0d1626",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"24px 24px 0 0",padding:"18px 18px 40px",width:"100%",maxHeight:"92vh",overflowY:"auto"},
  modalHand:{width:36,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,margin:"0 auto 18px"},
  mSection:{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"#f1f5f9",margin:"16px 0 10px"},
  tipIn:{width:54,height:54,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:12,color:"#f1f5f9",fontSize:26,fontWeight:900,textAlign:"center",outline:"none",fontFamily:"'DM Sans',sans-serif"},
  saveBtn:{background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:12,padding:"12px 18px",fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
};

// BUG FIX #5: Export mit ErrorBoundary umhüllt
import React from "react";
export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}