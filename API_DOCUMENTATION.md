# Bit90 Admin Backend API Documentation

## Overview

This is a comprehensive admin backend system for the Bit90 betting platform. The API provides role-based access control (RBAC), secure authentication, and full management capabilities for users, finances, KYC, support, and system settings.

**Base URL**: `http://your-domain.com/admin`

**Authentication**: JWT Bearer Token (include in Authorization header)

---

## Authentication

### POST /admin/auth/login
Login to admin panel.

**Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "twoFactorCode": "123456" // Required if 2FA is enabled
}
```

**Response**:
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "admin": {
    "id": "admin_id",
    "fullName": "Admin Name",
    "username": "admin",
    "email": "admin@example.com",
    "role": "super_admin",
    "permissions": ["*"],
    "lastLogin": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /admin/auth/refresh
Refresh access token using refresh token.

**Request Body**:
```json
{
  "refreshToken": "refresh_token_here"
}
```

### POST /admin/auth/logout
Logout from current device.

**Headers**: `Authorization: Bearer <token>`

### POST /admin/auth/logout-all
Logout from all devices.

**Headers**: `Authorization: Bearer <token>`

### POST /admin/auth/change-password
Change admin password.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

### POST /admin/auth/reset-password/request
Request password reset.

**Request Body**:
```json
{
  "email": "admin@example.com"
}
```

### POST /admin/auth/reset-password/confirm
Reset password with token.

**Request Body**:
```json
{
  "token": "reset_token",
  "newPassword": "new_password"
}
```

### POST /admin/auth/2fa/enable
Enable two-factor authentication.

**Headers**: `Authorization: Bearer <token>`

### POST /admin/auth/2fa/disable
Disable two-factor authentication.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "twoFactorCode": "123456"
}
```

### GET /admin/auth/profile
Get current admin profile.

**Headers**: `Authorization: Bearer <token>`

---

## Dashboard

### GET /admin/dashboard/statistics
Get dashboard statistics.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_dashboard`

**Response**:
```json
{
  "statistics": {
    "users": {
      "total": 1000,
      "active": 950,
      "online": 50,
      "newToday": 10
    },
    "finance": {
      "todayDeposits": { "totalAmount": 50000, "count": 100 },
      "todayWithdrawals": { "totalAmount": 30000, "count": 50 },
      "pendingWithdrawals": 20
    },
    "kyc": {
      "pending": 15
    },
    "betting": {
      "total": 10000,
      "today": 500
    },
    "revenue": {
      "total": 100000,
      "today": 5000
    },
    "bonuses": {
      "totalIssued": 20000
    },
    "support": {
      "openTickets": 30
    },
    "referrals": {
      "total": 200
    }
  }
}
```

### GET /admin/dashboard/revenue
Get revenue chart data.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/dashboard/bets
Get bets chart data.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/dashboard/deposits-withdrawals
Get deposits vs withdrawals chart data.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/dashboard/new-users
Get new users chart data.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/dashboard/monthly-profit
Get monthly profit chart data.

**Headers**: `Authorization: Bearer <token>`

---

## User Management

### GET /admin/users
Get all users with pagination and filters.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by phone or email
- `status` (optional): Filter by status
- `sortBy` (optional): Sort field (default: `createdAt`)
- `sortOrder` (optional): `asc` or `desc` (default: `desc`)

### GET /admin/users/:userId
Get user by ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

### PUT /admin/users/:userId
Update user information.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Request Body**:
```json
{
  "phone": "+254700000000",
  "email": "user@example.com",
  "status": "active"
}
```

### POST /admin/users/:userId/freeze
Freeze user account.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `freeze_users`

**Request Body**:
```json
{
  "reason": "Suspicious activity detected"
}
```

### POST /admin/users/:userId/suspend
Suspend user account.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `freeze_users`

**Request Body**:
```json
{
  "reason": "Violation of terms"
}
```

### POST /admin/users/:userId/activate
Activate user account.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `freeze_users`

### POST /admin/users/:userId/reset-password
Reset user password.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `freeze_users`

**Request Body**:
```json
{
  "newPassword": "new_password"
}
```

### GET /admin/users/:userId/betting-history
Get user betting history.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### GET /admin/users/:userId/deposits
Get user deposits.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### GET /admin/users/:userId/withdrawals
Get user withdrawals.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### GET /admin/users/:userId/login-history
Get user login history.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

### GET /admin/users/:userId/referral-info
Get user referral information.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

---

## KYC Management

### GET /admin/kyc
Get all KYC submissions.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_kyc`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status
- `documentType` (optional): Filter by document type
- `sortBy` (optional): Sort field (default: `submittedAt`)
- `sortOrder` (optional): `asc` or `desc` (default: `desc`)

### GET /admin/kyc/:kycId
Get KYC submission by ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_kyc`

### GET /admin/kyc/user/:userId
Get KYC submission by user ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_kyc`

### POST /admin/kyc/:kycId/approve
Approve KYC submission.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `approve_kyc`

**Request Body**:
```json
{
  "notes": "Documents verified successfully"
}
```

### POST /admin/kyc/:kycId/reject
Reject KYC submission.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `reject_kyc`

**Request Body**:
```json
{
  "reason": "Document unclear",
  "notes": "Please resubmit with clearer image"
}
```

### POST /admin/kyc/:kycId/request-resubmission
Request KYC resubmission.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `request_kyc_resubmission`

**Request Body**:
```json
{
  "reason": "Missing document",
  "notes": "Please upload back side of ID"
}
```

### GET /admin/kyc/statistics
Get KYC statistics.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_kyc`

---

## Finance

### GET /admin/finance/deposits
Get all deposits.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_deposits`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status
- `paymentMethod` (optional): Filter by payment method
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date
- `minAmount` (optional): Filter by minimum amount
- `maxAmount` (optional): Filter by maximum amount
- `sortBy` (optional): Sort field (default: `createdAt`)
- `sortOrder` (optional): `asc` or `desc` (default: `desc`)

### GET /admin/finance/withdrawals
Get all withdrawals.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_withdrawals`

**Query Parameters**: Same as deposits

### GET /admin/finance/transactions/:transactionId
Get transaction by ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_deposits` or `view_withdrawals`

### POST /admin/finance/withdrawals/:transactionId/approve
Approve withdrawal.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `approve_withdrawals`

**Request Body**:
```json
{
  "notes": "Withdrawal approved"
}
```

### POST /admin/finance/withdrawals/:transactionId/reject
Reject withdrawal.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `reject_withdrawals`

**Request Body**:
```json
{
  "reason": "Insufficient funds",
  "notes": "User balance is too low"
}
```

### POST /admin/finance/withdrawals/:transactionId/hold
Place withdrawal on hold.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `approve_withdrawals` or `reject_withdrawals`

**Request Body**:
```json
{
  "notes": "Under review"
}
```

### GET /admin/finance/statistics
Get finance statistics.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_deposits` or `view_withdrawals`

---

## Bonus Management

### GET /admin/bonuses
Get all bonuses.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `type` (optional): Filter by type
- `status` (optional): Filter by status
- `sortBy` (optional): Sort field (default: `createdAt`)
- `sortOrder` (optional): `asc` or `desc` (default: `desc`)

### GET /admin/bonuses/:bonusId
Get bonus by ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

### POST /admin/bonuses
Create new bonus.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

**Request Body**:
```json
{
  "name": "Welcome Bonus",
  "type": "welcome",
  "amount": 100,
  "percentage": 100,
  "minDeposit": 50,
  "maxBonus": 100,
  "wagerRequirement": 10,
  "expiryDate": "2024-12-31T23:59:59.000Z",
  "validityPeriod": 72,
  "promoCode": "WELCOME100",
  "isNewUsersOnly": true
}
```

### PUT /admin/bonuses/:bonusId
Update bonus.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

### DELETE /admin/bonuses/:bonusId
Delete bonus.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

### GET /admin/bonuses/statistics
Get bonus statistics.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

---

## Support Tickets

### GET /admin/support/tickets
Get all support tickets.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status
- `priority` (optional): Filter by priority
- `category` (optional): Filter by category
- `assignedTo` (optional): Filter by assigned admin
- `sortBy` (optional): Sort field (default: `createdAt`)
- `sortOrder` (optional): `asc` or `desc` (default: `desc`)

### GET /admin/support/tickets/:ticketId
Get ticket by ID.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

### POST /admin/support/tickets
Create support ticket.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

**Request Body**:
```json
{
  "userId": "user_id",
  "subject": "Issue with deposit",
  "category": "deposit",
  "priority": "high",
  "message": "My deposit is not showing in my account"
}
```

### POST /admin/support/tickets/:ticketId/messages
Add message to ticket.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

**Request Body**:
```json
{
  "message": "We are looking into your issue",
  "attachments": [],
  "isInternal": false
}
```

### POST /admin/support/tickets/:ticketId/assign
Assign ticket to admin.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

**Request Body**:
```json
{
  "adminId": "admin_id"
}
```

### POST /admin/support/tickets/:ticketId/resolve
Resolve ticket.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `resolve_tickets`

**Request Body**:
```json
{
  "resolution": "Issue resolved successfully"
}
```

### POST /admin/support/tickets/:ticketId/close
Close ticket.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `resolve_tickets`

### GET /admin/support/tickets/statistics
Get ticket statistics.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_tickets`

---

## Reports

### GET /admin/reports/revenue
Generate revenue report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `export_finance_reports`

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/reports/deposits
Generate deposits report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_deposits`

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `paymentMethod` (optional): Filter by payment method
- `status` (optional): Filter by status
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/reports/withdrawals
Generate withdrawals report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_withdrawals`

**Query Parameters**: Same as deposits report

### GET /admin/reports/bets
Generate bets report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `export_finance_reports`

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/reports/users
Generate users report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_users`

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/reports/bonus-costs
Generate bonus costs report.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `create_bonuses`

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `period` (optional): `daily`, `weekly`, `monthly` (default: `daily`)

### GET /admin/reports/export
Export report as CSV.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `export_finance_reports`

**Query Parameters**:
- `reportType` (required): `revenue`, `deposits`, `withdrawals`, `bets`
- `startDate` (optional): Start date
- `endDate` (optional): End date

---

## Payment Settings

### GET /admin/settings/payment
Get payment settings.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

### PUT /admin/settings/payment/mpesa
Update M-Pesa settings.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

**Request Body**:
```json
{
  "shortcode": "174379",
  "passkey": "passkey",
  "consumerKey": "consumer_key",
  "consumerSecret": "consumer_secret",
  "environment": "sandbox",
  "minDeposit": 10,
  "maxDeposit": 150000,
  "minWithdrawal": 100,
  "maxWithdrawal": 70000,
  "transactionFee": 0,
  "processingTime": 5
}
```

### PUT /admin/settings/payment/airtel
Update Airtel Money settings.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

**Request Body**:
```json
{
  "clientId": "client_id",
  "clientSecret": "client_secret",
  "environment": "sandbox",
  "minDeposit": 10,
  "maxDeposit": 150000,
  "minWithdrawal": 100,
  "maxWithdrawal": 70000,
  "transactionFee": 0,
  "processingTime": 5
}
```

### PUT /admin/settings/payment/bank
Update Bank Transfer settings.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

**Request Body**:
```json
{
  "bankName": "Equity Bank",
  "accountNumber": "1234567890",
  "accountName": "Bit90 Ltd",
  "minDeposit": 100,
  "maxDeposit": 1000000,
  "minWithdrawal": 500,
  "maxWithdrawal": 500000,
  "transactionFee": 0,
  "processingTime": 60
}
```

### PUT /admin/settings/payment/crypto
Update Crypto settings.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

**Request Body**:
```json
{
  "supportedCoins": ["BTC", "ETH", "USDT"],
  "walletAddress": "wallet_address",
  "minDeposit": 0.001,
  "maxDeposit": 100000,
  "minWithdrawal": 0.001,
  "maxWithdrawal": 10,
  "transactionFee": 0,
  "processingTime": 30
}
```

### POST /admin/settings/payment/maintenance
Toggle maintenance mode.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_maintenance_mode`

**Request Body**:
```json
{
  "enabled": true,
  "message": "System under maintenance"
}
```

### POST /admin/settings/payment/gateway/toggle
Enable/disable payment gateway.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `configure_payment_gateways`

**Request Body**:
```json
{
  "gateway": "mpesa",
  "enabled": true
}
```

---

## Server Monitoring

### GET /admin/monitoring/health
Get server health status.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_server_health`

**Response**:
```json
{
  "health": {
    "cpu": {
      "usage": 25,
      "cores": 4
    },
    "memory": {
      "total": 16,
      "used": 8,
      "free": 8,
      "percentage": 50
    },
    "disk": {
      "total": 100,
      "used": 50,
      "free": 50,
      "percentage": 50
    },
    "database": {
      "status": "connected",
      "latency": 5
    },
    "api": {
      "status": "healthy",
      "uptime": "5d 10h 30m",
      "uptimeSeconds": 466200
    },
    "activeSessions": 100,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /admin/monitoring/logs
Get system logs.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_logs`

**Query Parameters**:
- `level` (optional): Log level (default: `info`)
- `limit` (optional): Number of logs (default: 100)

### GET /admin/monitoring/error-logs
Get error logs.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `view_logs`

**Query Parameters**:
- `limit` (optional): Number of logs (default: 50)

---

## Notifications

### GET /admin/notifications
Get all notifications for current admin.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `unreadOnly` (optional): `true` or `false` (default: `false`)

### POST /admin/notifications/:notificationId/read
Mark notification as read.

**Headers**: `Authorization: Bearer <token>`

### POST /admin/notifications/read-all
Mark all notifications as read.

**Headers**: `Authorization: Bearer <token>`

### DELETE /admin/notifications/:notificationId
Delete notification.

**Headers**: `Authorization: Bearer <token>`

---

## Game Configuration (Super Admin Only)

### GET /admin/
Get admin dashboard with game configuration.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: Super Admin only

### GET /admin/config
Get game configuration.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: Super Admin only

### PUT /admin/config
Update game configuration.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: Super Admin only

**Request Body**:
```json
{
  "crash_mode": "auto",
  "rtp_param": 0.97,
  "band_weights": {
    "instant": 1,
    "low": 5,
    "medium": 10,
    "high": 3,
    "very_high": 1
  }
}
```

### PUT /admin/crash-range
Update manual crash range.

**Headers**: `Authorization: Bearer <token>`

**Permissions**: Super Admin only

**Request Body**:
```json
{
  "min": 1.00,
  "max": 10.00
}
```

---

## Roles and Permissions

### Role Definitions

#### Super Admin
- **Permissions**: Full access (`*`)
- **Can**: Everything including game configuration

#### Finance Admin
- **Permissions**: `view_deposits`, `view_withdrawals`, `approve_withdrawals`, `reject_withdrawals`, `export_finance_reports`, `view_dashboard`
- **Cannot**: Delete admins, change system settings

#### Support Admin
- **Permissions**: `view_users`, `freeze_users`, `chat_customers`, `resolve_tickets`, `view_tickets`, `view_dashboard`
- **Cannot**: Approve withdrawals

#### KYC Admin
- **Permissions**: `view_kyc`, `approve_kyc`, `reject_kyc`, `request_kyc_resubmission`, `view_dashboard`
- **Cannot**: Access financial operations

#### Marketing Admin
- **Permissions**: `create_bonuses`, `manage_referrals`, `create_promo_codes`, `send_notifications`, `view_dashboard`
- **Cannot**: Access user management

#### System Admin
- **Permissions**: `configure_payment_gateways`, `view_server_health`, `view_logs`, `configure_maintenance_mode`, `view_dashboard`
- **Cannot**: Access user data or financial operations

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error message"
    }
  ]
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `423` - Locked (account locked)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions per role
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: All inputs validated and sanitized
- **XSS Protection**: Input sanitization to prevent XSS attacks
- **Password Hashing**: Bcrypt with salt rounds
- **Account Lockout**: Automatic lockout after failed attempts
- **Audit Logging**: All admin actions logged
- **Session Management**: Multi-device session support
- **2FA Support**: Optional two-factor authentication

---

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Sensitive Operations**: 3 requests per hour per IP
- **Admin Operations**: 200 requests per 15 minutes per IP

---

## Notes

- All timestamps are in ISO 8601 format
- All monetary values are in the platform's base currency
- Pagination uses 1-based indexing
- All audit logs are immutable and cannot be deleted
- Game configuration changes (crash_mode, crash range) are restricted to Super Admin only
- Manual crash point control is a high-privilege feature available only to Super Admin
