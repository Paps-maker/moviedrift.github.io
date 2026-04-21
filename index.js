const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(express.json());

// Initialize Firebase Admin (You'll get this JSON from Firebase Settings)
const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 1. Get Access Token
const getAccessToken = async () => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
    const res = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
        headers: { Authorization: `Basic ${auth}` }
    });
    return res.data.access_token;
};

// 2. Trigger STK Push
app.post("/stk", async (req, res) => {
    const { phone, amount, userId } = req.body;
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString("base64");

    const payload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: `${process.env.SERVER_URL}/callback?userId=${userId}`,
        AccountReference: "MovieDrift",
        TransactionDesc: "Subscription"
    };

    try {
        await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ success: true, message: "Prompt sent to phone" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. The Magic Callback (Safaricom calls this)
app.post("/callback", async (req, res) => {
    const callbackData = req.body.Body.stkCallback;
    const userId = req.query.userId;

    if (callbackData.ResultCode === 0) {
        const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
        await db.collection("users").doc(userId).update({
            status: "Paid",
            subscriptionExpiresAt: expiry
        });
        console.log(`User ${userId} activated!`);
    }
    res.send("OK");
});

app.listen(process.env.PORT || 3000, () => console.log("Server running..."));