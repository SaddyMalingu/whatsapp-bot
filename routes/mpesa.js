import express from "express";

const router = express.Router();

// Safaricom will POST payment confirmations here
router.post("/callback", (req, res) => {
  console.log("✅ M-Pesa Callback received:");
  console.log(JSON.stringify(req.body, null, 2));

  // Send success acknowledgment to Safaricom
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted successfully" });
});

export default router;
