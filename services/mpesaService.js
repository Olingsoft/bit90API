'use strict';

/**
 * M-Pesa Daraja API Service
 *
 * Handles OAuth token generation, STK Push initiation, and STK Query
 * for payment verification. All secrets are read from environment
 * variables — the service fails fast if any are missing.
 */

// ── Environment validation ──────────────────────────────────────────────────
const REQUIRED_ENV = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[M-Pesa] Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// ── API base URLs ───────────────────────────────────────────────────────────
function getBaseUrl() {
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
  if (env === 'production' || env === 'live') {
    return 'https://api.safaricom.co.ke';
  }
  return 'https://sandbox.safaricom.co.ke';
}

// ── Timestamp in East Africa Time (UTC+3) ───────────────────────────────────
function getTimestamp() {
  // M-Pesa requires yyyyMMddHHmmss in East Africa Time (UTC+3)
  const now = new Date();
  // Convert to EAT by adding 3 hours to UTC
  const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const year = eat.getUTCFullYear();
  const month = String(eat.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eat.getUTCDate()).padStart(2, '0');
  const hours = String(eat.getUTCHours()).padStart(2, '0');
  const minutes = String(eat.getUTCMinutes()).padStart(2, '0');
  const seconds = String(eat.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// ── Password generation ─────────────────────────────────────────────────────
function generatePassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

// ── Phone number formatting ─────────────────────────────────────────────────
function formatPhone(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = `254${cleaned.slice(1)}`;
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('254')) cleaned = `254${cleaned}`;
  return cleaned;
}

// ── OAuth access token ──────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const baseUrl = getBaseUrl();

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[M-Pesa] OAuth token request failed:', response.status, errorText);
    throw new Error('Failed to authenticate with M-Pesa');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Safaricom tokens typically expire in 3600 seconds
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  console.log('[M-Pesa] OAuth access token obtained successfully');
  return cachedToken;
}

// ── STK Push ────────────────────────────────────────────────────────────────
/**
 * Initiate an M-Pesa STK Push request.
 *
 * @param {Object} options
 * @param {string} options.phone    - Customer phone (any format)
 * @param {number} options.amount   - Amount in KSh (integer)
 * @param {string} [options.accountRef] - Account reference (max 12 chars)
 * @param {string} [options.transactionDesc] - Description (max 13 chars)
 * @returns {Object} { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
 */
async function initiateSTKPush({ phone, amount, accountRef, transactionDesc }) {
  validateEnv();

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const baseUrl = getBaseUrl();
  const timestamp = getTimestamp();
  const password = generatePassword(shortcode, passkey, timestamp);
  const formattedPhone = formatPhone(phone);
  const accessToken = await getAccessToken();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.floor(Number(amount)),
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: (accountRef || 'Bit90 Deposit').slice(0, 12),
    TransactionDesc: (transactionDesc || 'Deposit').slice(0, 13),
  };

  console.log('[M-Pesa] Initiating STK Push for phone:', formattedPhone, 'amount:', payload.Amount);

  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();

  if (!response.ok || responseData.errorCode) {
    console.error('[M-Pesa] STK Push failed:', JSON.stringify(responseData));
    throw new Error(
      responseData.errorMessage || responseData.CustomerMessage || 'STK Push request failed'
    );
  }

  console.log(
    '[M-Pesa] STK Push accepted — MerchantRequestID:',
    responseData.MerchantRequestID,
    'CheckoutRequestID:',
    responseData.CheckoutRequestID
  );

  return responseData;
}

// ── STK Query (payment verification) ────────────────────────────────────────
/**
 * Query the status of an STK Push transaction.
 *
 * @param {string} checkoutRequestId - The CheckoutRequestID from the STK Push response
 * @returns {Object} { ResultCode, ResultDesc, ... }
 */
async function querySTKPushStatus(checkoutRequestId) {
  validateEnv();

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const baseUrl = getBaseUrl();
  const timestamp = getTimestamp();
  const password = generatePassword(shortcode, passkey, timestamp);
  const accessToken = await getAccessToken();

  console.log('[M-Pesa] Querying STK status for CheckoutRequestID:', checkoutRequestId);

  const response = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.errorCode) {
    console.error('[M-Pesa] STK Query failed:', JSON.stringify(data));
    throw new Error(data.errorMessage || 'STK Query request failed');
  }

  console.log('[M-Pesa] STK Query result — ResultCode:', data.ResultCode, 'ResultDesc:', data.ResultDesc);
  return data;
}

// ── Parse callback metadata ─────────────────────────────────────────────────
/**
 * Extract named values from CallbackMetadata.Item[] array.
 *
 * @param {Array} items - The Item array from CallbackMetadata
 * @returns {Object} { Amount, MpesaReceiptNumber, TransactionDate, PhoneNumber }
 */
function parseCallbackMetadata(items) {
  const result = {};
  if (!Array.isArray(items)) return result;

  for (const item of items) {
    if (item.Name && (item.Value !== undefined && item.Value !== null)) {
      result[item.Name] = item.Value;
    }
  }
  return result;
}

module.exports = {
  initiateSTKPush,
  querySTKPushStatus,
  parseCallbackMetadata,
  formatPhone,
  getTimestamp,
};
