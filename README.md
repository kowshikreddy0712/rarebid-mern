# RareBid — MERN Auction Marketplace Starter

RareBid is a starter full-stack marketplace for rare collectibles, antiques, and one-of-a-kind items. It includes a React/Vite interface and a Node/Express/MongoDB API with authenticated actions, listing review, live auction updates, and server-side bid processing.

> **Important:** This is a runnable MVP, not a production-ready marketplace. Seller verification supports private document uploads and an administrator review workflow, but it does not independently verify identity. Use non-sensitive test files while developing; do not use real identity documents until secure storage and retention policies have been reviewed. Product photos can be uploaded to local disk (5 MB image limit), and evidence documents are stored privately on local disk with access checks; move both to properly configured object storage and add malware/content scanning before production. Winner contact emails work when SMTP is configured. Payment is available through an optional Razorpay checkout when test/live credentials are configured; refunds, seller payouts/split settlement, escrow, and carrier integrations are not implemented.

## Included features

- React responsive marketplace with search, expanded categories (vehicles, gold & treasures, art, militaria, memorabilia, antiques and more), status filters, auction cards, details, and bid history.
- Account registration/login with bcrypt password hashing and JWT in an HttpOnly cookie.
- Seller verification request workflow, private evidence-document upload, and protected admin review screens. The workflow does not itself authenticate a person or certify an item.
- Listing submission and administrator approval before public visibility.
- Auction durations of 1, 2, 5, 10, 15, 30, or 60 minutes; advance scheduling.
- Socket.IO auction rooms, live price changes, and closure updates.
- Backend validation of seller restrictions, minimum bid increments, auction timing, and bid amounts.
- MongoDB transaction around bid state and the bid record, with an idempotency key.
- Background auction start/close processing and idempotent winner order creation.
- Watchlist, auction reminders with in-app notifications, bidder activity, orders overview, and admin review queue.
- Product-photo uploads (JPG/PNG/WEBP/GIF, up to 5 MB) to local development storage, with a backend upload endpoint.
- Private evidence-document uploads (PDF/JPG/PNG/WEBP, up to 5 files at 10 MB each) with owner/admin-only downloads, for seller verification or listing review.
- Configurable SMTP email to the winning bidder after an auction closes, including seller name and email for delivery coordination. Failed emails are retried by the scheduler.
- Demo data seed script with vehicle, gold, art, memorabilia, and historical-militaria examples; each is labelled as sample data and not independently authenticated.
- Environment examples and local MongoDB replica-set Docker configuration.

## Requirements

- Node.js 20 or newer recommended
- npm
- Docker Desktop (recommended for local MongoDB) **or** MongoDB Atlas configured as a replica set

MongoDB transactions require a replica set. The included Docker Compose file starts a single-node replica set for development.

## Quick start on Windows

Open PowerShell in the project folder.

### 1. Start MongoDB (Docker or Atlas)

**Option A — MongoDB Atlas (no Docker required):**

1. Create a free deployment at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Create a database user under **Database Access** and allow your current IP under **Network Access**.
3. Select **Connect → Drivers → Node.js** and copy the connection string.
4. Later, put that URI in `backend/.env` as `MONGODB_URI`. Keep the database name `rarebid`; Atlas deployments support transactions through their replica-set configuration.

Example format (replace placeholders; URL-encode special characters in the password):

```text
mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/rarebid?retryWrites=true&w=majority
```

**Option B — local MongoDB with Docker Desktop:**

```powershell
docker compose up -d mongo
```

Wait until MongoDB is healthy. The compose health check initializes replica set `rs0`. The default URI in the example is:

```text
mongodb://127.0.0.1:27017/rarebid?replicaSet=rs0
```

If you already run MongoDB on port 27017, stop that service or change the host port in `docker-compose.yml`.

### 2. Configure the backend

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env`. Set `JWT_SECRET` to a random secret of at least 32 characters. Keep `COOKIE_SECURE=false` for local HTTP development. The `MONGODB_URI` should include `?replicaSet=rs0` if using the supplied Docker configuration.

Example development values (change the secret and admin credentials):

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/rarebid?replicaSet=rs0
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
CLIENT_URL=http://localhost:5173
COOKIE_SECURE=false
ADMIN_NAME=RareBid Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeThisAdminPassword123!
```

### 3. Install dependencies

From the project root:

```powershell
npm run install:all
```

Or install in each folder with `npm install`.

### 4. Seed an administrator and demo listings

```powershell
npm run seed
```

The seed script reads the administrator name, email, and password from `backend/.env`. It creates the admin only if that email does not already exist. The sample listings are explicitly demo data; their item authenticity is not independently verified.

### 5. Optional: configure winner contact emails

The app emails the winning bidder the seller's name and email after the auction closes, so they can discuss delivery. The admin can also set a product authenticity-review status: not assessed, evidence reviewed, specialist authentication pending, specialist authenticated, or unable to verify. Configure SMTP in `backend/.env`:

```dotenv
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
MAIL_FROM=RareBid <verified-sender@your-domain.example>
PUBLIC_API_URL=http://localhost:5000
```

Use credentials from your email provider; do not commit them. For Gmail, use an App Password when eligible rather than your normal account password. Without SMTP settings, the auction and order workflow still runs, but no email is sent. The app retries pending winner emails when SMTP is configured. The email is sent after auction closure and is retried independently of payment status.


### 6. Optional: configure Razorpay test payments

The Orders tab includes a **Pay now** flow when an order is awaiting payment. To enable it, create Razorpay test credentials and add them to `backend/.env`:

```dotenv
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Configure the Razorpay webhook endpoint as `http://localhost:5000/api/v1/payments/webhook` only when using a reachable development tunnel or deployed backend. Subscribe to `payment.captured` and/or `order.paid`. Test mode credentials are required for local experimentation. The checkout callback signature is verified on the server and the webhook is also signature-checked when configured. Do not use live keys before security, legal, tax, refund, seller settlement, and payment-provider compliance are complete. This MVP does not automatically split or pay out funds to sellers.

### 7. Run the API and frontend

Open two PowerShell terminals in the project root.

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
Copy-Item frontend/.env.example frontend/.env
npm run dev:frontend
```

Open `http://localhost:5173`. API health check: `http://localhost:5000/api/health`.

Login to the admin dashboard using the credentials configured in `backend/.env`. The admin account can review seller verification requests and listing submissions.

## Suggested demo flow

1. Register a regular user.
2. Open **Seller verification** and submit the form. In this MVP, the evidence field is only a reviewer note/reference; do not enter sensitive ID numbers or public document links.
3. Log out and log into the seeded admin account.
4. Open **Admin dashboard → Seller verification** and mark the test seller verified.
5. Log back in as that seller and use **Sell an item** to submit a listing. Choose a future start time; the listing remains private until approved.
6. Log in as admin and approve the listing. If the scheduled start time has already passed during review, the backend reschedules it to begin in about one minute.
7. Browse the approved auction and test bidding from another account. You cannot bid on your own item.
8. For a quick demonstration, use a 1-minute duration and observe automatic closure. If there is a valid bid, an `awaiting_payment` order record is created. With SMTP configured, the winner receives the seller's contact email. With Razorpay test keys configured, the buyer can use the Orders tab to test checkout.

## Project structure

```text
rarebid-mern/
├── backend/
│   ├── src/
│   │   ├── config/        MongoDB connection
│   │   ├── middleware/    Authentication and admin authorization
│   │   ├── models/        User, Auction, Bid, Watchlist, Order
│   │   ├── routes/        Versioned REST API routes
│   │   ├── services/      Auction lifecycle scheduler
│   │   ├── seed.js        Admin and demo listings
│   │   └── server.js      Express + Socket.IO server
│   └── .env.example
├── frontend/
│   ├── src/components/    Header, auction cards
│   ├── src/context/       Authentication context
│   ├── src/pages/         Marketplace, detail, auth, seller, admin views
│   ├── src/api.js         Axios client and formatting helpers
│   └── src/styles.css     Responsive design system
├── docker-compose.yml
└── README.md
```

## Main API routes

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET /api/v1/auctions`, `GET /api/v1/auctions/:id`, `POST /api/v1/auctions`, `POST /api/v1/auctions/:id/bids`
- `POST /api/v1/users/seller-verification`
- `GET /api/v1/users/watchlist`, `POST /api/v1/users/watchlist/:auctionId`, `DELETE /api/v1/users/watchlist/:auctionId`
- `GET /api/v1/users/reminders`, `POST /api/v1/users/reminders/:auctionId`, `DELETE /api/v1/users/reminders/:auctionId`
- `GET /api/v1/users/notifications`, `PATCH /api/v1/users/notifications/read-all`, `PATCH /api/v1/users/notifications/:notificationId/read`
- `GET /api/v1/users/my-activity`
- `GET /api/v1/admin/overview`, `/api/v1/admin/verifications`, `/api/v1/admin/listings`, `/api/v1/admin/orders` and matching review PATCH endpoints

## Architecture notes and limitations

- MongoDB is the source of truth for bid state. Socket.IO carries updates; clients cannot make themselves the winner.
- Bid state and bid history are committed in a MongoDB transaction. Use Atlas or a replica-set deployment in every environment where bids can be placed.
- The scheduler runs within the API process and recovers expired auctions when the process is running again. For multiple backend instances or high volume, move scheduling to a distributed worker/queue with leader-safe or idempotent processing.
- The current bid model uses whole-rupee integer amounts. For other currencies or fractional units, use integer minor units and an explicit currency field.
- The first bid can meet the starting price; later bids must meet `currentPrice + minIncrement`.
- Search uses MongoDB text indexes and filters for category, price, status, and authenticity-review status. Use a dedicated search service only when justified by scale.
- The demo auth uses HttpOnly cookies, but a production deployment should also add email verification, robust password reset, CSRF assessment appropriate to the deployment, and audit/monitoring operations.
- Socket.IO rooms are public read channels in this MVP. Bid mutations remain on authenticated REST endpoints. Never use socket events alone as proof that a bid was committed.
- Payment checkout can be tested through Razorpay when configured; refunds, seller payout/split settlement, shipping/carrier integration, and dispute resolution remain future production work.

## Production work still required

1. Real seller identity verification; the current evidence-document upload is private to the listing owner and administrators but still needs production storage, malware scanning, audit logging, and retention controls.
2. Production-grade private media/document storage, malware scanning, content-signature validation, file processing, and lifecycle/retention policies.
3. Email verification, password-reset flow, and reliable user notifications/reminders.
4. Complete payment operations: refund flows, seller payouts/split settlement, dispute handling, settlement reconciliation, and payment-provider compliance checks.
5. Shipping integration, delivery confirmation, support and disputes.
6. Rate limiting/anti-abuse tuning, audit-log coverage, monitoring, backups, restore testing, and end-to-end tests for concurrent bids.
7. Legal review of marketplace terms, prohibited goods, taxes, consumer obligations, privacy, and payment-provider requirements for the operating jurisdiction.


## Upload and category safety notes

- Product photos upload to `backend/uploads` during development and are served from `/uploads`. This is intentionally simple for local testing. Do not store identity documents in this public directory.
- The Militaria category is intended for lawful historical collectibles and display items only. Listings mentioning functional firearms, ammunition, or explosives are rejected by a basic server-side rule; this is not a complete legal or moderation system. Check applicable local laws before enabling any regulated category.
- Demo listings and photos are examples only. They are not verified real-world items, offers, valuations, or claims of celebrity endorsement.
- SMTP email sends the winner seller contact details; never put private phone numbers or other sensitive data in a public listing. Consider platform-mediated messaging and consent/privacy review before production.
