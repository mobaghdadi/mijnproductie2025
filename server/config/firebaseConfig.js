const admin = require("firebase-admin");
require("dotenv").config(); // Laadt .env-variabelen

console.log("Firebase Config Debug:", {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? "Loaded" : "Not Loaded",
});


// Initialiseer Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Zorgt dat newline-karakters correct worden gelezen
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET, 
});

const db = admin.firestore();

module.exports = { admin, db };

