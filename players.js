import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyCDzf-onH9ZARUQK4t7XmYDe_k4Gw-H8r0", // don't hack me please lmao
  authDomain: "echotiers-3163d.firebaseapp.com",
  projectId: "echotiers-3163d",
  storageBucket: "echotiers-3163d.firebasestorage.app",
  messagingSenderId: "273553094514",
  appId: "1:273553094514:web:298ba79e08549686f8cfeb"
};

// Initialize Firebase, Auth and Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// EchoTier - S+ is highest, F is lowest
export const echoTiers = ["S+", "S", "A", "B", "C", "D", "E", "F"];

// McTier - ht1 (high tier 1) is highest, lt5 (low tier 5) is lowest
export const mcTiers = [
  "ht1", "lt1",
  "ht2", "lt2",
  "ht3", "lt3",
  "ht4", "lt4",
  "ht5", "lt5"
];

// Google Sign-In
// Opens the Google pop-up, then the player chooses their own custom name.
// Email is taken automatically from their Google account.
// Players are stored in the Firestore "players" collection, keyed by their uid.
export async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Logged in user:", user.displayName);

    // Player chooses their own custom name
    const name = prompt("Choose your player name:", user.displayName || "");
    if (!name) {
      alert("You must choose a name to register.");
      return null;
    }

    // Check if this player already exists in Firestore
    const playerRef = doc(db, "players", user.uid);
    const snapshot = await getDoc(playerRef);

    if (!snapshot.exists()) {
      // New player - save them to the database with default (lowest) tiers
      await setDoc(playerRef, {
        username: name,
        email: user.email,
        echotier: "F",   // default until ranked
        mctier: "lt5",   // default until ranked
        elo: 100,
        wins: 0,
        losses: 0,
      });
      alert("Welcome, " + name + "! You've been registered. (" + user.email + ")");
    } else {
      alert("Welcome back, " + snapshot.data().username + "!");
    }

    return {
      uid: user.uid,
      name: name,
      email: user.email,
    };
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
}

// Fetch the real player list from Firestore
export async function getPlayers() {
  const snapshot = await getDocs(collection(db, "players"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Update a player's data (e.g. tiers after ranking them)
export async function updatePlayer(uid, updates) {
  await setDoc(doc(db, "players", uid), updates, { merge: true });
}

// ELO system (chess)
const K = 32; // max points that can move in one match

// score: 1 = win, 0 = loss
export function calculateNewElo(playerElo, opponentElo, score) {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(playerElo + K * (score - expected));
}

// Call this after a match. Pass the two player objects from getPlayers().
// Updates elo, wins and losses for both players in Firestore.
export async function applyMatchResult(winner, loser) {
  const winnerElo = calculateNewElo(winner.elo ?? 100, loser.elo ?? 100, 1);
  const loserElo  = calculateNewElo(loser.elo ?? 100, winner.elo ?? 100, 0);

  await updatePlayer(winner.id, {
    elo: winnerElo,
    wins: (winner.wins || 0) + 1,
  });

  await updatePlayer(loser.id, {
    elo: loserElo,
    losses: (loser.losses || 0) + 1,
  });

  return { winnerElo, loserElo };
}