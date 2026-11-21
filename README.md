# Deal Glass

**Asymmetric Multi-Party Chat • Zero-Leak Dual-Channel Relay**

Built for the **NexConn Build Challenge**, **Deal Glass** is a real-time communication firewall for agencies, brokers, and middlemen managing high-stakes client–vendor workflows. Instead of putting clients and external contractors in the same group chat—where budgets, contact details, and brand names leak—Deal Glass routes every message through a **Broker Control Room** powered by the **Nexconn Chat SDK**.

🔗 **Live Demo:** `https://deal-glass.vercel.app/`

---

## The Problem
When agencies or brokers coordinate between a **Client** and a **Vendor/Freelancer**, standard group chats create three immediate business risks:
1. **Disintermediation:** Clients and vendors exchange phone numbers, emails, or links and bypass the broker.
2. **Margin Exposure:** Mentioning client budgets (`₹50,000`) or contractor rates (`₹28,000`) breaks pricing confidentiality.
3. **Zero Review Buffer:** Clients state raw deadlines (*"deliver by Friday"*), leaving the broker no buffer time for QA before delivery.

## How Deal Glass Solves It
Deal Glass enforces a **Zero-Leak Dual-Channel Relay** where the Client and Vendor never share a direct channel:

```text
[ Client ] ──(DirectChannel)──▶ [ Broker Control Room ] ──(DirectChannel)──▶ [ Vendor ]
                                   │
                                   ├─ 1. Real-Time Refraction Engine (lib/refract.ts)
                                   │     • Masks phones, emails, URLs & currencies
                                   │     • Shields custom brand/company keywords
                                   │     • Shifts deadlines by a configurable review buffer (-2d)
                                   │
                                   ├─ 2. Broker Quarantine Gate
                                   │     • High-risk leaks pause for Approve / Edit / Block
                                   │     • Low-risk messages auto-relay with deadline shifts
                                   │
                                   └─ 3. Ghost Whispers
                                         • Private Broker → Client, Broker → Vendor, or Both
