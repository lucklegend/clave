# Heartbeat ClaveHQ — Recommended Tech Stack

You need **one web app** (browser mode) and **one mobile app** (iOS + Android) that share the same data and business logic. Below is the stack I'd pick for a solo/small-team build, and why.

## TL;DR

| Layer               | Choice                                                                                  | Why                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile app          | **React Native + Expo**                                                                 | One codebase for iOS + Android, huge ecosystem, camera/image-picker for receipts built-in, OTA updates without app-store review                                                          |
| Web app             | **Next.js (React + TypeScript)**                                                        | Shares language/types with mobile, great for the admin-heavy "browser mode," easy to deploy                                                                                              |
| Shared code         | **Monorepo (Turborepo + pnpm workspaces)**                                              | One `packages/shared` for types, validation schemas, and the API client — write business logic once                                                                                      |
| Backend/DB          | **Supabase (Postgres + Auth + Storage + Realtime)**                                     | Fastest way to get auth, a real relational database, file storage (for receipt screenshots/PDFs), and row-level security for multi-tenant data — without you hand-building an API server |
| Push notifications  | **Expo push service + FCM/APNs**                                                        | Native to your mobile stack                                                                                                                                                              |
| Messaging reminders | **Twilio (WhatsApp Business API)**, Viber Business Messages API separately              | Phase 2 — both require business approval, budget lead time                                                                                                                               |
| Payments (Phase 2)  | **PayMongo**                                                                            | PH-based gateway; supports GCash, Maya, cards, bank transfer natively                                                                                                                    |
| Hosting             | **Vercel** (web), **Supabase Cloud** (DB/auth/storage), **EAS Build** (mobile binaries) | Minimal DevOps for a small team                                                                                                                                                          |
| Error tracking      | **Sentry**                                                                              | Free tier covers early-stage apps                                                                                                                                                        |

## Why this combination (reasoning, since you said you're unsure)

**Mobile: React Native + Expo, not native Swift/Kotlin.**
You need one app that works for potentially thousands of residents across many villages — building and maintaining two native codebases (Swift + Kotlin) is 2x the work for a small team. Expo specifically (not "bare" React Native) gives you:

- Built-in modules for camera/photo picker (needed for payment-receipt screenshots), push notifications, and secure storage — no native build setup needed to start.
- **EAS Build** to produce real App Store/Play Store binaries without owning a Mac (you can build iOS apps from Windows/Linux via EAS's cloud build).
- Over-the-air (OTA) JS updates — you can ship bug fixes without waiting for app store review, which matters a lot for a young product.

**Web: Next.js, not a separate framework like Vue/Angular.**
Since your mobile app is React Native, using **React (via Next.js)** for the web app means the same language (TypeScript), the same mental model for components/state, and — most importantly — you can share a `packages/shared` folder containing your TypeScript types, Zod validation schemas, and API-client functions between both apps. You are not duplicating "what is a Booking object" or "how do I call the bookings API" in two different languages.

**Backend: Supabase, not a hand-rolled Node/Express API + separate database.**
This is the biggest lever for a small team's speed:

- **Auth**. As built (0003), the **web portal** signs in with email-or-username + password and
  with Google OAuth. **Phone-number OTP remains the plan for the mobile app** — PH users are
  phone-first, many don't check email regularly, and phone numbers double as their GCash-linked
  identity. All three land on the same `auth.users` row, and the schema keeps the phone path
  open: `public.users.email` is nullable, `phone` is carried, and the `users_contactable` CHECK
  requires one or the other.
- **Storage** buckets for payment receipt screenshots and PDF attachments, with access rules tied to the same auth system.
- **Row-Level Security (RLS)** in Postgres — this is what makes your app properly multi-tenant. Every table has a `village_id`; a policy ensures a resident of Village A can never see Village B's data, enforced at the database level, not just in app code (much safer).
- **Realtime** subscriptions — announcements and booking updates can push to residents' screens live, without you building a WebSocket server.
- You still get a real Postgres database underneath, so nothing about this locks you in — you can always add a custom backend (e.g., Node + tRPC) later for anything Supabase can't do, like Phase 2 payment gateway webhooks.

**Monorepo (Turborepo + pnpm):** keeps `apps/web`, `apps/mobile`, and `packages/shared` in one repository so a change to, say, the "Booking" type is instantly available to both apps, and CI can build/test everything together.

## Suggested repo layout

```
heartbeat-clavehq/
├── apps/
│   ├── web/          # Next.js admin + resident web portal
│   └── mobile/        # Expo React Native app
├── packages/
│   ├── shared/         # Types, Zod schemas, API client, constants
│   └── config/         # Shared ESLint/TS config
├── supabase/
│   ├── migrations/     # SQL migrations (tables, RLS policies)
│   └── functions/      # Edge functions (e.g. reminder cron, webhook handlers)
├── docs/                # This proposal, handoff.md, etc.
├── turbo.json
└── pnpm-workspace.yaml
```

## Data model sketch (starting point)

- `villages` (tenant root: name, slug, tier) — **built**
- `users` (linked 1:1 to the Supabase `auth.users` row: village_id, email, username, full_name,
  phone, avatar_url, status) — **built**. Named `users`, not `profiles`, so it reads with the
  grant tables below.
- `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions` — **built**.
  Roles are named bundles of capabilities; `user_permissions` carries per-user `allow`/`deny`
  overrides, and a `deny` beats everything. `village_id` on a grant is the _scope_ of that
  grant, which is not the same as the person's home village on `users` — one person can be an
  owner in village A and an officer in village B. Resolution lives in
  `public.user_has_permission(permission, village, user)`.
- `units` (house/lot/unit number, village_id, owner_id)
- `payments` (unit_id, type: electricity/water/repair/dues, amount, method, receipt_url, status: pending/verified/rejected)
- `announcements` (village_id, author_id, body, attachment_url)
- `amenities` (village_id, name, type, slot_duration_minutes)
- `bookings` (amenity_id, user_id, start_time, end_time, status)
- `reports` (village_id, reporter_id, type: incident/urgent/maintenance-request, status, assigned_to)

Each of these (except `villages`) gets an RLS policy scoped to `village_id`.

## What NOT to build yourself in v1

- A custom real-time chat server (use Supabase Realtime or a channel-based approach instead).
- A payment gateway integration (screenshots + manual verification is enough for MVP; PayMongo is a clean Phase 2 add since it natively supports GCash/Maya/bank transfer).
- Your own push-notification infrastructure (use Expo's push service).
