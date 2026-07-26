const { onCall, HttpsError } = require('firebase-functions/v2/https');

// In-memory rate limiter: uid -> array of timestamps
const callLog = {};
const RATE_LIMIT = 30;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(uid) {
  const now = Date.now();
  if (!callLog[uid]) callLog[uid] = [];
  callLog[uid] = callLog[uid].filter((t) => now - t < WINDOW_MS);
  if (callLog[uid].length >= RATE_LIMIT) {
    throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
  }
  callLog[uid].push(now);
}

function computeSettlements(expenses) {
  const pairwiseDebts = {};

  for (const exp of expenses) {
    const { payer, amount, involved } = exp;
    if (!amount || !payer || !involved || involved.length === 0) continue;

    const splitAmount = parseFloat(amount) / involved.length;

    for (const person of involved) {
      if (person === payer) continue;

      const key = `${person}->${payer}`;
      const reverseKey = `${payer}->${person}`;

      if (reverseKey in pairwiseDebts) {
        pairwiseDebts[reverseKey] -= splitAmount;
        if (pairwiseDebts[reverseKey] < -0.001) {
          const remaining = Math.abs(pairwiseDebts[reverseKey]);
          delete pairwiseDebts[reverseKey];
          pairwiseDebts[key] = remaining;
        } else if (Math.abs(pairwiseDebts[reverseKey]) < 0.001) {
          delete pairwiseDebts[reverseKey];
        }
      } else {
        pairwiseDebts[key] = (pairwiseDebts[key] || 0) + splitAmount;
      }
    }
  }

  const results = [];
  for (const [key, amt] of Object.entries(pairwiseDebts)) {
    if (amt > 0.01) {
      const [debtor, creditor] = key.split('->');
      results.push(`${debtor} owes ${creditor} $${amt.toFixed(2)}`);
    }
  }
  return results.length > 0 ? results : ['No debts found!'];
}

exports.calculateSettlements = onCall({ region: 'us-central1' }, (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to calculate settlements.');
  }

  checkRateLimit(request.auth.uid);

  const expenses = request.data;

  if (!Array.isArray(expenses) || expenses.length === 0) {
    throw new HttpsError('invalid-argument', 'Expected a non-empty array of expenses.');
  }

  for (let i = 0; i < expenses.length; i++) {
    const { payer, amount, involved } = expenses[i];
    if (!payer || typeof payer !== 'string') {
      throw new HttpsError('invalid-argument', `Expense ${i}: payer must be a non-empty string.`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new HttpsError('invalid-argument', `Expense ${i}: amount must be a positive number.`);
    }
    if (!Array.isArray(involved) || involved.length === 0) {
      throw new HttpsError('invalid-argument', `Expense ${i}: involved must be a non-empty array.`);
    }
  }

  return computeSettlements(expenses);
});
