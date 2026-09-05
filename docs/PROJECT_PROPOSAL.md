# Heartbeat ClaveHQ — Project Proposal

**Tagline:** The Heartbeat of Your Community
**Category:** SaaS — Community / HOA Management (Web + Mobile)

## 1. Problem

Philippine subdivisions, villages, and condos still run on manual processes:

- Dues/maintenance fees tracked in notebooks or group chats — no one can see who has paid.
- Bulletin boards for announcements — easy to miss, no archive.
- Function hall / amenity bookings via phone calls or a physical logbook — double-bookings happen.
- No structured way to report incidents or reach guards/maintenance quickly.

## 2. Target Market

- HOA boards / subdivision developers (the paying admin)
- Condo corporations / property managers
- Individual owners and tenants (the end users)

## 3. Competitive Landscape

- **Qmunidad** — a Philippine-built village management platform (visitor logging, dues collection, ~₱999/month per village, no setup fee). Closest direct competitor — same market, same pain points (guards logging visitors on paper, treasurers chasing dues in group chats).
- **TownSq, PayHOA, HOA Central, ManageCasa** — larger US-focused HOA platforms with financials, violations, e-voting. Feature-rich but not built for PH payment habits (GCash/Maya/bank transfer, phone-first users) and priced for US HOAs.
- **HOA 360, EstateMate, Houman** — smaller regional apps (Saudi, South Africa) — announcements, chat, ticketing, but no PH payment-proof workflow.
- **Ardmore Park (reference)** — a luxury condo site with a resident portal login (built by a property/facilities manager) — validates that a branded resident portal + admin backend is the expected shape of this product, though it's a single-building system, not multi-tenant SaaS.

**Your differentiation:** built specifically for how PH villages actually pay (GCash/Maya/bank transfer screenshots, not US-style ACH), a generous **free tier** to win over price-sensitive small HOAs (vs. Qmunidad's flat monthly fee from day one), and a tiered upsell path (guard/maintenance calling, bookings, incident reporting) rather than one all-or-nothing package.

## 4. User Roles

| Role                  | Description                                            | Primary use                               |
| --------------------- | ------------------------------------------------------ | ----------------------------------------- |
| **Super Admin** (you) | Manages villages/subscriptions across the platform     | Billing, tenant provisioning              |
| **HOA Admin/Officer** | Board member or property manager for one village/condo | Announcements, dues tracking, approvals   |
| **Owner**             | Owns the unit/house                                    | Pay dues, book amenities, report issues   |
| **Tenant**            | Rents the unit/house                                   | Same as owner minus title-related actions |
| **Maintenance Crew**  | Outside-hired staff, paid by HOA                       | Receives/resolves reports                 |
| **Security Guard**    | Agency-hired, paid by HOA                              | Receives urgent/incident reports          |

## 5. Monetization

**Free Tier**

- Announcement board
- HOA fee/maintenance fee monitoring
- Add tenants/owners (cap: 50 users)
- Officer rescheduling

**Tier 1 (paid, monthly, per village)** — adds:

- Unlimited tenants/owners
- Speak/Call to guard & maintenance crew
- Amenity booking/scheduling (function hall, court, pool, playground, gym)
- Incident/accident reporting system

_Suggested future Tier 2 (not in your original scope, worth flagging for later): automated payment gateway (PayMongo), e-voting, visitor/gate-pass management (Qmunidad's strongest feature), document e-signatures._

## 6. Core Features (MVP scope)

1. **Payment monitoring** — tenant/owner uploads a screenshot/receipt per payment (electricity, water, repair); admin marks paid/unpaid/verified. No live gateway integration in MVP — screenshot + manual verification only.
2. **Announcement board** — admin posts text + image/PDF attachments (e.g. government notices); residents get notified.
3. **Amenity booking** — calendar-based booking for function hall, court, pool, playground, gym, with configurable time slots (commonly 2-hour blocks) and conflict prevention.
4. **User & role registration** — owners, tenants, maintenance crew, security guards, each with distinct permissions.
5. **Reporting/notification system** — urgent (calls/alerts security or maintenance) vs. non-urgent (garbage, renovation requests to officers), with status tracking.
6. **Income/payment tracking dashboard** for officers.
7. **Payment reminders** — in-app + WhatsApp/Viber (Phase 2 for the messaging integration, since Business API approval takes time).

## 7. Platforms

- **Web (browser mode)** — for admins/officers doing heavier data entry and reporting.
- **Mobile app (iOS + Android)** — for residents' day-to-day use (pay, book, report).

## 8. Suggested Build Order (MVP → Tier 1)

1. Auth + village/tenant setup + user roles
2. Announcement board
3. Payment monitoring (screenshot upload + admin verification)
4. Amenity booking system
5. Incident/reporting system
6. Guard/maintenance "call" feature + WhatsApp/Viber reminders

See `TECH_STACK.md` for the recommended stack and `HANDOFF.md` for how to resume this project across sessions.
