# Foreman

Field service management SaaS for general contractors. Three dashboards: owner, worker, and property manager portal.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/yourusername/foreman)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

## ✨ Features

- **Multi-role Dashboard**: Separate interfaces for owners, workers, and property managers
- **Property Management**: Complete property and tenant management system
- **Work Order System**: Streamlined maintenance request to completion workflow
- **Job Tracking**: Real-time job status updates and photo documentation
- **Invoice Generation**: Automated invoicing with Stripe integration
- **Billing Management**: Subscription handling with trial periods
- **Rate Limiting**: Production-ready Redis-based rate limiting
- **Error Monitoring**: Sentry integration for error tracking
- **Security**: HTTPS enforcement, CSP, and comprehensive security headers

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for billing)
- Resend account (for emails)

### 1. Clone and Install

```bash
git clone <repository-url>
cd foreman
npm install
```

### 2. Environment Setup

```bash
cp .env.local.example .env.local
```

Fill in the following environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend (Email)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_email@domain.com

# Stripe (Billing)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
STRIPE_PRO_PRICE_ID=your_price_id

# Redis (Rate Limiting - Optional)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Sentry (Error Monitoring - Optional)
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_public_sentry_dsn

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema:

```bash
# In Supabase SQL Editor, paste the contents of:
cat supabase/schema.sql
```

3. Create a storage bucket:
   - Name: `job-photos`
   - Public: `false`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📱 User Roles

### Owner Dashboard
- Business management and settings
- Property and property manager oversight
- Worker management and invitations
- Invoice and billing management
- Analytics and reporting

### Worker Dashboard
- Job assignments and status updates
- Photo documentation
- Time tracking
- Communication with property managers

### Property Manager Portal
- Maintenance request submission
- Job progress tracking
- Invoice access
- Communication with workers

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
```

### Project Structure

```
foreman/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── owner/             # Owner dashboard
│   ├── worker/            # Worker dashboard
│   ├── portal/            # Property manager portal
│   └── globals.css        # Global styles
├── components/            # Reusable components
├── lib/                   # Utilities and configurations
├── supabase/              # Database schema
├── types/                 # TypeScript types
└── __tests__/             # Test files
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- __tests__/integration.test.ts
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Manual Deployment

```bash
npm run build
npm start
```

### Environment Variables for Production

Ensure these are set in your production environment:

- All Supabase variables
- Stripe webhook endpoint configured
- Redis for rate limiting (recommended)
- Sentry for error monitoring (recommended)
- HTTPS enabled

## 🔒 Security

- **Rate Limiting**: Redis-based sliding window rate limiting
- **Content Security Policy**: Strict CSP with necessary allowances
- **HTTPS Enforcement**: Automatic HTTP to HTTPS redirects
- **Input Validation**: Zod schema validation on all inputs
- **Authentication**: Supabase Auth with role-based access control

## 📊 Monitoring

- **Sentry**: Error tracking and performance monitoring
- **Rate Limiting Analytics**: Request monitoring with Upstash
- **Build Notifications**: Automated build status tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please contact [support@foremanapp.com](mailto:support@foremanapp.com) or create an issue in this repository.

---

Built with ❤️ using Next.js, TypeScript, Supabase, and Stripe.
VALUES (
  'USER_ID_FROM_AUTH',
  'TENANT_ID_FROM_ABOVE',
  'owner@email.com',
  'Your Name',
  'owner'
);
```

---

## Adding workers

As owner, go to `/owner/workers` → Invite Worker
- Creates a Supabase auth account
- Sends them login credentials
- They log in at the same URL, get redirected to `/worker`

## Adding property managers

Go to `/owner/properties` → Add Property Manager
- Generates a unique portal link
- Share the link with them: `yourdomain.com/portal?token=xxx`
- They submit work orders directly, no account needed

---

## App structure

```
/login              → Owner + worker login
/owner              → Owner dashboard
/owner/jobs         → All jobs
/owner/jobs/[id]    → Job detail (photos, notes, billing)
/owner/work-orders  → Work orders from property managers
/owner/workers      → Worker management
/owner/properties   → Property + PM management
/owner/invoices     → Invoice management
/worker             → Worker job list (mobile-first)
/worker/jobs/[id]   → Job detail with photo/note upload
/portal?token=xxx   → Property manager work order form (public)
```

---

## Scaling to other GCs

This is a multi-tenant app from day one. Each GC is a separate `tenant`. Their data is fully isolated via Supabase Row Level Security.

To onboard a new GC:
1. Create a tenant record
2. Create their owner profile
3. They invite their own workers and property managers

Pricing: charge per tenant via Stripe. The `tenants` table has `stripe_customer_id`, `stripe_subscription_id`, and `plan` fields ready.

---

## Deployment

### Vercel (recommended)
1. Connect GitHub repo
2. Add environment variables
3. Deploy

### Docker
```bash
docker build -t foreman .
docker run -p 3000:3000 foreman
```

### Production checklist
- [ ] Set up Stripe webhooks
- [ ] Configure email service (Resend)
- [ ] Set up monitoring (Vercel Analytics)
- [ ] Add rate limiting
- [ ] Enable RLS in Supabase
- [ ] Set up backups

---

## API

### Authentication
All owner/worker routes require authentication. Property manager portal is public but rate-limited.

### Rate limiting
- Portal submissions: 5 per PM per hour
- Configurable via `lib/rateLimit.ts`

### Error handling
- Centralized error responses
- Structured logging
- Type-safe API validation with Zod

---

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run test     # Run tests
npm run lint     # Lint code
```

---

## Contributing

1. Fork the repo
2. Create feature branch
3. Add tests
4. Submit PR

---

## License

MIT
