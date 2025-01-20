const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { admin, db } = require("./../config/firebaseConfig");
const { getStorage } = require("firebase-admin/storage"); 
require("dotenv").config();
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() }); // Voeg deze regel toe

const bucket = getStorage().bucket(); 

// Route voor bestanden of foto's uploaden
app.post(
  "/api/upload/:type/:issueId",
  upload.fields([{ name: "photos", maxCount: 10 }, { name: "files", maxCount: 10 }]),
  async (req, res) => {
    const { type, issueId } = req.params;
    console.log("Ontvangen bestanden:", req.files);
    console.log("Ontvangen key:", type);

    const files = req.files[type];

    if (!files || files.length === 0) {
      console.error(`Geen bestanden gevonden voor key: ${type}`);
      return res.status(400).send(`Geen bestanden gevonden voor key: ${type}`);
    }

    try {
      const uploadedUrls = [];
      for (const file of files) {
        // Genereer een unieke naam voor elk bestand
        const fileName = `${type}/${issueId}/${Date.now()}-${file.originalname}`;
        const fileUpload = bucket.file(fileName);

        // Upload bestand naar Firebase Storage
        await new Promise((resolve, reject) => {
          const stream = fileUpload.createWriteStream({
            metadata: {
              contentType: file.mimetype,
            },
          });

          stream.on("error", (error) => {
            console.error("Upload error:", error);
            reject(error);
          });

          stream.on("finish", async () => {
            await fileUpload.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            uploadedUrls.push(publicUrl);
            resolve();
          });

          stream.end(file.buffer);
        });
      }

      // Sla de URL's op in Firestore
      const issueRef = db.collection("issues").doc(issueId);
      await issueRef.update({
        [type === "photos" ? "photos" : "files"]: admin.firestore.FieldValue.arrayUnion(...uploadedUrls),
      });

      res.status(200).json({
        message: `${type === "photos" ? "Foto's" : "Bestanden"} succesvol geüpload`,
        urls: uploadedUrls,
      });
    } catch (error) {
      console.error("Error handling file upload:", error);
      res.status(500).send("Error handling file upload.");
    }
  }
);

app.get("/api/issues/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection("issues").doc(id).get();
    if (!doc.exists) {
      return res.status(404).send("Issue not found.");
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching issue:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Debug Firebase-configuratie
console.log("Firebase Config Path:", path.resolve(__dirname, "./config/firebaseConfig"));

// Haal alle storingen op
app.get("/api/issues", async (req, res) => {
  try {
    const snapshot = await db.collection("issues").get();
    const issues = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(issues);
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Voeg een storing toe
app.post("/api/issues", async (req, res) => {
  const { address, type, notes } = req.body;

  if (!address || !type) {
    return res.status(400).send("Address and type are required.");
  }

  try {
    const newIssue = {
      address,
      type,
      notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection("issues").add(newIssue);
    res.status(201).json({ id: docRef.id, ...newIssue });
  } catch (error) {
    console.error("Error adding issue:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.patch("/api/issues/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const issueRef = db.collection("issues").doc(id);
    const issue = (await issueRef.get()).data();

    if (!issue) {
      return res.status(404).send("Issue not found.");
    }

    // Als de storing al is opgelost, blokkeer verdere updates
    if (issue.status === "Opgelost") {
      return res.status(400).send("Issue is already resolved.");
    }

    // Alleen de datum opslaan als de status "Opgelost" wordt
    const currentDate = new Date().toLocaleDateString("en-CA"); // Formaat: YYYY-MM-DD
    const updateData = {
      status: "Opgelost",
      solvedAt: currentDate,
    };

    await issueRef.update(updateData);

    res.status(200).json({
      message: "Issue updated successfully",
      status: "Opgelost",
      solvedAt: currentDate,
    });
  } catch (error) {
    console.error("Error updating issue:", error);
    res.status(500).send("Internal Server Error");
  }
});



app.delete("/api/issues/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("issues").doc(id).delete();
    res.status(200).send("Issue deleted successfully.");
  } catch (error) {
    console.error("Error deleting issue:", error);
    res.status(500).send("Internal Server Error");
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
