---
version: 1
slug: "client-src-pages-landingpage-js"
primary_target: "client/src/pages/LandingPage.js"
related_targets: ["client/src/components/common/AppLayout.js","client/src/components/ui/index.js","client/src/pages/auth/Login.js"]
---

## Scope

- **Surfaces in scope:**
  - Public landing page (`/`), in Persuade mode.
  - Auth pages.
  - The signed-in app shell and shared UI primitives, which propagate to every app screen in Operate mode.
- **Audience:** placement officers at tier-2/3 engineering colleges, plus college management; students and recruiters follow.
- **Visitor action:** sign in, or contact EduMapping to bring a college on board (hello@edumapping.com, WhatsApp +91 91049 91059).
- **Proof:** real product behaviour, demonstrated with labelled sample records. No invented customers, figures or testimonials.

## Direction contract

**THESIS:** EduMapping is a learner's attested record: every screen is a document the placement cell has checked, sealed and signed. The page refuses the category default: gradient hero, tilted dashboard screenshot, logo strip and feature-card grid.

**OWN-WORLD:**
- **Grounds:** degree-folder navy (#0E1730 family) and security paper (#F7F4EC family).
- **Identity mark:** a generative guilloche rosette and border engraved in tricolour saffron and India green linework.
- **State inks:** violet attestation ink for verified/locked stamps, vermilion for sent back, green for cleared.
- **Type:** Archivo, expanded width, for headlines and figures (banknote denominations). Public Sans for reading. JetBrains Mono only for roll numbers, serials and figures.
- **Records:** certificates with a serial strip and a microtext rule.
- **Statuses:** rubber stamps.

**STORY:** The officer sees the season as a stack of verified documents and believes its numbers will survive an inspection. The school-to-career chain (marksheet → verified → drive → offer letter) shows the journey. The officer then signs in or gets in touch.

**FIRST VIEWPORT:** The navy field owns the screen.
- **Left, about 5 of 12 columns:**
  - The headline "From classroom to career." at display scale.
  - One sentence of offer.
  - The primary action "Bring your college on board" and a secondary "Sign in".
- **Right, about 7 columns:** a large sample academic record inside a guilloche frame that draws itself.
  - Fields fill in roll-number order.
  - A violet "VERIFIED · LOCKED" stamp presses at about 1.8s. This is the signature interaction, reused in-app.
- **Below:** the document chain as four linked certificates.

**FORM:** The Attested Record, position 1 of the ordered list (Impeccable's pick, chosen by the user over the roll). Seed key 67f4f98d.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
