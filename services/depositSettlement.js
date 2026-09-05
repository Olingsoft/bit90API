'use strict';

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mpesaService = require('./mpesaService');

const PROCESSING_CODES = new Set([4999]);
const FAILURE_CONFIRM_DELAY_MS = 20000;

function parseResultCode(value) {
  if (value === undefined || value === null || value === '' || value === 'PROCESSING') {
    return null;
  }
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function isSuccessCode(value) {
  return parseResultCode(value) === 0 || String(value).trim() === '0';
}

function isProcessingResult(value, desc) {
  if (value === 'PROCESSING') return true;
  const code = parseResultCode(value);
  if (code !== null && PROCESSING_CODES.has(code)) return true;
  const text = String(desc || '').toLowerCase();
  return text.includes('still under processing') || text.includes('being processed');
}

function extractStkCallback(body) {
  if (!body || typeof body !== 'object') return null;
  return (
    body.Body?.stkCallback ||
    body.body?.stkCallback ||
    body.stkCallback ||
    (body.CheckoutRequestID && body.ResultCode !== undefined ? body : null) ||
    null
  );
}

function parseTransactionDate(raw) {
  const ds = String(raw || '');
  if (ds.length < 14) return null;
  return new Date(
    `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T${ds.slice(8, 10)}:${ds.slice(10, 12)}:${ds.slice(12, 14)}+03:00`
  );
}

function isPaidCallback(callback, metadata) {
  if (metadata.MpesaReceiptNumber) return true;
  if (isSuccessCode(callback.ResultCode)) return true;
  const desc = String(callback.ResultDesc || '').toLowerCase();
  return desc.includes('processed successfully') && metadata.Amount != null;
}

function checkoutMatch(checkoutRequestId, merchantRequestId) {
  const or = [];
  if (checkoutRequestId) {
    or.push({ checkoutRequestId });
    or.push({ reference: checkoutRequestId });
  }
  if (merchantRequestId) {
    or.push({ merchantRequestId });
  }
  return or.length ? { $or: or } : null;
}

/**
 * Credit a deposit exactly once when M-Pesa has actually taken money.
 */
async function settleSuccessfulPayment({
  checkoutRequestId,
  merchantRequestId,
  amount,
  receipt,
  transactionDate,
  resultDesc,
  phone,
}) {
  const match = checkoutMatch(checkoutRequestId, merchantRequestId);
  if (!match) {
    console.error('[Deposit Settle] Missing CheckoutRequestID and MerchantRequestID');
    return null;
  }

  const existing = await Transaction.findOne({
    $and: [
      match,
      { $or: [{ credited: true }, { status: 'completed' }] },
    ],
  });
  if (existing) {
    console.log('[Deposit Settle] Already credited — Transaction:', existing._id);
    return existing;
  }

  const creditAmount = Number(amount);
  const setFields = {
    status: 'completed',
    credited: true,
    resultCode: 0,
    resultDesc: resultDesc || 'The service request is processed successfully',
    processedAt: new Date(),
  };
  if (checkoutRequestId) {
    setFields.checkoutRequestId = checkoutRequestId;
    setFields.reference = checkoutRequestId;
  }
  if (merchantRequestId) setFields.merchantRequestId = merchantRequestId;
  if (receipt) setFields.mpesaReceiptNumber = String(receipt);
  if (transactionDate) setFields.transactionDate = transactionDate;
  if (phone) setFields.phone = String(phone);

  let transaction;
  try {
    transaction = await Transaction.findOneAndUpdate(
      {
        $and: [
          match,
          { type: 'deposit' },
          { credited: { $ne: true } },
          { status: { $in: ['pending', 'failed'] } },
        ],
      },
      { $set: setFields },
      { new: true }
    );
  } catch (error) {
    if (error.code === 11000) {
      console.warn('[Deposit Settle] Duplicate receipt — treating as already processed');
      return Transaction.findOne(match);
    }
    throw error;
  }

  if (!transaction) {
    console.warn('[Deposit Settle] No matching deposit to credit', checkoutRequestId);
    return null;
  }

  const amountToCredit =
    Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : Number(transaction.amount);

  const user = await User.findByIdAndUpdate(
    transaction.userId,
    { $inc: { balance: amountToCredit } },
    { new: true }
  );

  if (user) {
    transaction.balanceAfter = Number(user.balance || 0);
    await transaction.save();
    console.log(
      '[Deposit Settle] Payment SUCCESS — User:',
      user._id,
      'Amount:',
      amountToCredit,
      'Receipt:',
      receipt || 'n/a',
      'NewBalance:',
      user.balance
    );
  } else {
    console.error('[Deposit Settle] User not found for transaction:', transaction._id);
  }

  return transaction;
}

async function tryConfirmPaidFromQuery(transaction) {
  const checkoutRequestId = transaction.checkoutRequestId || transaction.reference;
  if (!checkoutRequestId) {
    return { queryResult: null, settled: null };
  }

  const queryResult = await mpesaService.querySTKPushStatus(checkoutRequestId);
  if (!isSuccessCode(queryResult.ResultCode)) {
    return { queryResult, settled: null };
  }

  const settled = await settleSuccessfulPayment({
    checkoutRequestId,
    merchantRequestId: transaction.merchantRequestId,
    amount: transaction.amount,
    receipt: queryResult.MpesaReceiptNumber || null,
    resultDesc: queryResult.ResultDesc,
  });

  return { queryResult, settled };
}

/**
 * Delayed failure: a fail callback often arrives while the customer is still
 * paying. Re-query M-Pesa before writing FAILED. If money moved, credit instead.
 */
function scheduleFailureConfirmation({
  checkoutRequestId,
  merchantRequestId,
  resultCode,
  resultDesc,
}) {
  const code = parseResultCode(resultCode);
  if (code === null || PROCESSING_CODES.has(code)) return;

  setTimeout(() => {
    confirmFailureIfUnpaid({
      checkoutRequestId,
      merchantRequestId,
      resultCode: code,
      resultDesc,
    }).catch((error) => {
      console.error('[Deposit Settle] Failure confirm error:', error.message);
    });
  }, FAILURE_CONFIRM_DELAY_MS);
}

async function confirmFailureIfUnpaid({
  checkoutRequestId,
  merchantRequestId,
  resultCode,
  resultDesc,
}) {
  const match = checkoutMatch(checkoutRequestId, merchantRequestId);
  if (!match) return;

  const transaction = await Transaction.findOne(match);
  if (!transaction || transaction.credited || transaction.status === 'completed') {
    return;
  }

  try {
    const { queryResult, settled } = await tryConfirmPaidFromQuery(transaction);
    if (settled) return;

    if (queryResult && isProcessingResult(queryResult.ResultCode, queryResult.ResultDesc)) {
      console.log(
        '[Deposit Settle] Fail callback ignored — still processing',
        checkoutRequestId
      );
      return;
    }

    if (queryResult && isSuccessCode(queryResult.ResultCode)) {
      return;
    }
  } catch (error) {
    console.warn('[Deposit Settle] Could not confirm failure via query:', error.message);
    return;
  }

  const updated = await Transaction.findOneAndUpdate(
    {
      _id: transaction._id,
      credited: { $ne: true },
      status: 'pending',
    },
    {
      $set: {
        status: 'failed',
        resultCode,
        resultDesc,
        processedAt: new Date(),
      },
    },
    { new: true }
  );

  if (updated) {
    console.log(
      '[Deposit Settle] Payment FAILED after confirmation — Transaction:',
      updated._id,
      'ResultCode:',
      resultCode,
      'ResultDesc:',
      resultDesc
    );
  }
}

async function handleStkCallback(req, res) {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    console.log(
      '[M-Pesa Callback] Received body keys:',
      req.body && typeof req.body === 'object' ? Object.keys(req.body) : typeof req.body
    );

    const callback = extractStkCallback(req.body);
    if (!callback) {
      console.error('[M-Pesa Callback] Invalid callback body — missing stkCallback');
      return;
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = callback;

    const metadata = mpesaService.parseCallbackMetadata(CallbackMetadata?.Item || []);

    console.log(
      '[M-Pesa Callback] CheckoutRequestID:',
      CheckoutRequestID,
      'ResultCode:',
      ResultCode,
      'ResultDesc:',
      ResultDesc,
      'Receipt:',
      metadata.MpesaReceiptNumber || 'n/a'
    );

    if (isPaidCallback(callback, metadata)) {
      await settleSuccessfulPayment({
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        amount: metadata.Amount,
        receipt: metadata.MpesaReceiptNumber,
        transactionDate: parseTransactionDate(metadata.TransactionDate),
        resultDesc: ResultDesc,
        phone: metadata.PhoneNumber,
      });
      return;
    }

    scheduleFailureConfirmation({
      checkoutRequestId: CheckoutRequestID,
      merchantRequestId: MerchantRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
    });
  } catch (error) {
    console.error('[M-Pesa Callback] Processing error:', error.message, error.stack);
  }
}

module.exports = {
  parseResultCode,
  isSuccessCode,
  isProcessingResult,
  extractStkCallback,
  settleSuccessfulPayment,
  tryConfirmPaidFromQuery,
  scheduleFailureConfirmation,
  handleStkCallback,
};
