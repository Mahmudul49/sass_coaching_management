# EduPilot — User Manual

**Smart School & Coaching Management Software**

*A complete guide for Super Admins and Coaching‑Center Administrators*

---

## Table of Contents

1. [About EduPilot](#1-about-edupilot)
2. [Key Concepts & Terminology](#2-key-concepts--terminology)
3. [User Roles & What Each Can Do](#3-user-roles--what-each-can-do)
4. [Signing In](#4-signing-in)
5. [The Super Admin Console](#5-the-super-admin-console)
6. [The Coaching‑Center Admin Area](#6-the-coaching-center-admin-area)
   - 6.1 [Dashboard](#61-dashboard)
   - 6.2 [First‑Run Setup Wizard](#62-first-run-setup-wizard)
   - 6.3 [Classes](#63-classes)
   - 6.4 [Sections](#64-sections)
   - 6.5 [Fee Structure & Per‑Student Overrides](#65-fee-structure--per-student-overrides)
   - 6.6 [Students](#66-students)
   - 6.7 [Attendance](#67-attendance)
   - 6.8 [Payments](#68-payments)
   - 6.9 [Reports](#69-reports)
   - 6.10 [Results (Exams, Marks & Transcripts)](#610-results-exams-marks--transcripts)
   - 6.11 [Messages](#611-messages)
   - 6.12 [Settings](#612-settings)
7. [SMS Notifications](#7-sms-notifications)
8. [Printing: Receipts & Transcripts](#8-printing-receipts--transcripts)
9. [Installing EduPilot as an App (PWA / Android)](#9-installing-edupilot-as-an-app-pwa--android)
10. [Security & Data Privacy](#10-security--data-privacy)
11. [Frequently Asked Questions](#11-frequently-asked-questions)
12. [Appendix A — Glossary](#appendix-a--glossary)
13. [Appendix B — Field Reference](#appendix-b--field-reference)

---

## 1. About EduPilot

EduPilot is a **multi‑tenant** management platform for schools and coaching centers. A single EduPilot installation hosts many independent centers ("tenants"). Each center manages its own students, classes, fees, attendance, payments, and exam results in complete isolation — no center can ever see another center's data.

The software is **mobile‑first** and designed for non‑technical institution owners. The administrative interface is presented in **English**; automated text messages sent to guardians are written in **Bengali**, with amounts and dates rendered for a Bangladesh audience (Taka currency, Bengali numerals in SMS).

**What EduPilot does:**

- Central platform administration (creating and managing centers and staff)
- Per‑center student, class, and section management
- Bulk student import from Excel
- Monthly fee structures with per‑student, per‑month overrides
- Attendance recording with optional guardian SMS
- Fee collection with partial payments, advance handling, printable receipts, and WhatsApp sharing
- Due reports and attendance reports with Excel export
- Full exam‑results workflow: subjects, exams, mark entry, grading, publishing, and printable academic transcripts
- Private two‑way messaging between each center and the platform operator
- Guardian SMS notifications (attendance, payment, results)

**Technology at a glance:** EduPilot is a web application (Next.js) backed by a MongoDB database, with NextAuth for sign‑in and Material UI for the interface. It can be installed as an app on phones and desktops.

---

## 2. Key Concepts & Terminology

| Term | Meaning |
|---|---|
| **Center / Tenant** | One coaching center or school. Each has its own data, admin account, and web address. |
| **Slug** | The short, lowercase name used in a center's web address (e.g. `demo` in `.../demo/login`). Letters, digits, and hyphens only. |
| **Super Admin** | The platform operator who creates and manages all centers and platform staff. |
| **Platform Admin** | A restricted, read‑only platform staff member. |
| **Admin** | A center owner/administrator who runs one center. |
| **Fee Structure** | The default monthly charges defined per class (admission, monthly fee, model tests, other components). |
| **Fee Override** | A per‑student, per‑month payable that replaces the class fee structure for that student in that month. |
| **Not Enrolled** | A student‑month with a payable of 0 (excluded from all due/collection figures). |
| **Advance** | Money paid beyond what is currently due; automatically carried forward to future months. |
| **Arrear / Due** | An unpaid balance from an earlier month. |
| **Draft / Published (exam)** | An exam's status. Marks can be edited only while **draft**; publishing is one‑way and locks the marks. |

**How money is calculated (important):** EduPilot never stores a "balance." Instead, it records the raw amounts you collect and then, whenever a report is opened, spreads a student's total paid money across their enrolled months **oldest‑first**. Overpayment in one month automatically prepays later months (advance); underpayment leaves the earliest months due first. Because nothing is pre‑calculated, editing a fee or a payment instantly and correctly recalculates every report.

The same principle applies to exam results — totals, percentages, GPA, grades, and pass/fail are all computed on the fly from the marks and the grading scale, so correcting a single mark instantly updates results and transcripts.

---

## 3. User Roles & What Each Can Do

EduPilot has three roles. Access is enforced centrally on the server for every page and action.

| Capability | Super Admin | Platform Admin | Center Admin |
|---|:---:|:---:|:---:|
| Enter the platform console | ✅ | ✅ (read‑only) | ❌ |
| View the console dashboard | ✅ | ✅ | ❌ |
| View the list of centers | ✅ | ✅ | ❌ |
| Create / edit / activate centers | ✅ | ❌ | ❌ |
| Cross‑center student search ("Marketing") | ✅ | ✅ | ❌ |
| Manage platform users & roles | ✅ | ❌ | ❌ |
| Theme Builder | ✅ | ❌ | ❌ |
| Platform ↔ center messaging (reply, broadcast, delete) | ✅ | ❌ | ❌ |
| Clean / Delete a center's data | ✅ | ❌ | ❌ |
| Run a single center (all center features below) | ❌ | ❌ | ✅ |

**Notes**

- A **Center Admin** can only ever access their own center. Attempting to reach another center returns a "forbidden" error.
- A **Super Admin** cannot operate inside a center's admin area — the console and the center areas are separate.
- The system protects itself: you cannot delete or deactivate your own account or demote the **last remaining active Super Admin**.

---

## 4. Signing In

EduPilot uses **phone number + password** to sign in. There is no separate username.

### Web addresses

- **Platform console (Super Admin / Platform Admin):** the site's root address, e.g.
  `https://yourdomain.com/login`
- **A center (Center Admin):** the site address followed by the center's slug, e.g.
  `https://yourdomain.com/demo/login`

Visiting a center's home address forwards a signed‑in admin straight to their dashboard; if not signed in, the login screen appears. An unknown center slug shows a "not found" page.

### Steps to sign in

1. Open the correct web address (above).
2. Enter your **phone number** and **password**.
3. Tap **Login**.

### Security while signing in

- **Brute‑force lockout:** After **5 failed attempts** on the same account, that account is temporarily locked for **15 minutes**. The counter resets automatically after the window passes or on a successful login.
- **Instant revocation:** If a Super Admin deactivates your center or your account, your session is ended automatically within about **one minute** — you don't stay logged in until the token expires.
- **Deactivated centers/accounts cannot sign in** at all.

---

## 5. The Super Admin Console

The console is where the platform operator manages the whole EduPilot installation. Sign in at the root address. The left sidebar shows only the sections your role can access. The console supports a **light/dark mode toggle** (top bar).

### 5.1 Dashboard

The landing page shows four summary tiles:

- **Total active students** (across all centers)
- **Total centers**
- **Active centers**
- **Total admins**

Below the tiles is the **Centers** list, where Super Admins create and manage centers.

### 5.2 Managing Centers

From the dashboard's Centers area, a Super Admin can:

**Create a center.** Provide:
- **Center name** (shown in that center's interface)
- **Admin name** (the owner's display name)
- **Phone** (the admin's login and contact number)
- **Password** (at least 6 characters)
- **Slug** (the address label — lowercase letters, digits, hyphens; reserved words such as `www`, `admin`, `api`, `app`, `login`, `superadmin` are not allowed and must be unique)

Creating a center provisions both the center profile and its admin login in one step. New centers start with **attendance SMS turned off** (a cost‑control default).

**Edit a center.** Change the center name, slug, admin name, phone, and optionally set a new password. Changing the slug changes the center's web address (the new slug must still be unique).

**Activate / deactivate a center.** Deactivating a center immediately blocks its admin from signing in and signs out any active session within ~1 minute. Data is preserved; reactivating restores access.

**Copy the center's login link.** The list shows each center's address (`yourdomain/slug/login`) so you can share it with the owner.

### 5.3 Danger Zone — Clean & Delete Center

Two irreversible operations are available to Super Admins only. Both require you to type an exact confirmation phrase **and** re‑enter your own Super Admin password, and both are recorded in an append‑only **audit log** (who did what, to which center, and the outcome).

| Operation | Confirm phrase | What it removes | What it keeps |
|---|---|---|---|
| **Clean Center Data** | `CLEAN CENTER` | All operational data: students, classes, sections, fees, overrides, attendance, payments, SMS log, messages, subjects, exams, marks, results settings | The center **profile** and its **admin login** (the admin can start fresh) |
| **Delete Center** | `DELETE CENTER` | Everything above **plus** the center's users and the center profile itself (the slug becomes free again) | Nothing except the audit record |

Both run as all‑or‑nothing database transactions: if anything fails, the whole operation rolls back and nothing is removed. Only the target center's data is ever touched — other centers are never affected.

### 5.4 Users & Roles (Super Admin only)

Manage platform staff accounts (people who work in the console, not center admins).

- **Create user:** name, phone, password (min 6), and role (**Super Admin** or **Platform Admin**).
- **Edit user:** change name, phone, and role.
- **Reset password**, **activate/deactivate**, and **delete** users.

**Safeguards:** You cannot change your own role, deactivate your own account, or delete yourself. The system always keeps **at least one active Super Admin** — the last one cannot be demoted, deactivated, or deleted.

### 5.5 Students — Marketing Data (Super Admin & Platform Admin)

A cross‑center, read‑only student search intended for outreach/marketing. You can:

- Search students by text
- Filter by a specific center
- Toggle **active‑only** vs. all students

Results show matched students with their center. This view is read‑only — it does not allow editing student records.

### 5.6 Messages (Super Admin only)

A private support channel between the platform and each center (one conversation per center).

- **Inbox:** a searchable list of center conversations with unread counts and last‑message previews.
- **Open a conversation** to read the full thread and reply to that center's admin.
- **Broadcast:** send one message to **all** center admins at once.
- **Soft delete:** the Super Admin can remove a message from a thread (it is hidden, not hard‑erased).
- Unread counts appear as a badge in the navigation.

*Platform Admins cannot send, reply, broadcast, mark read, or delete messages.*

### 5.7 Theme Builder (Super Admin only)

Customize the **console** color palette (the platform back‑office look) for both **light** and **dark** mode. You can set colors for primary, secondary, accent, success, warning, error, background, surface, text, border, sidebar, navbar, and button tokens. Changes apply across the console. *Center interfaces use their own built‑in theme and are not affected by this.*

---

## 6. The Coaching‑Center Admin Area

Center admins sign in at `yourdomain/{slug}/login` and land on their dashboard. The interface adapts to screen size:

- **Desktop:** a persistent left sidebar (collapsible to an icon rail) with grouped navigation.
- **Mobile:** a top bar plus a bottom navigation bar (Dashboard, Students, Payments, Messages, and **More** for everything else).

**Navigation groups**

- **Dashboard**
- **Students**
- **Academic:** Attendance · Results · Classes · Sections
- **Finance:** Payments · Reports · Fee Structure
- **Messages** (with an unread badge)
- **Settings**

### 6.1 Dashboard

The dashboard opens on your center's overview (always shown in English):

- **Quick Actions** — large tiles jumping to Payments, Attendance, Reports, and Students.
- **Financial summary tiles:** Active Students, Today's Collection, This Month's Collection, This Month's Due, This Year's Collection, This Year's Due.
- **Monthly collection progress bar** — how much of the current month's payable has been collected, with collected vs. due amounts.
- **Monthly collection chart** — collection trend across the year.
- **Setup checklist** — appears until initial setup is complete.
- **Students overview** — active student counts per class (an aggregate, so the page stays fast even with very large rolls).

**First run:** If your center has no classes yet, the dashboard automatically sends you to the **Setup Wizard**.

### 6.2 First‑Run Setup Wizard

A guided, 4‑step flow to prepare a brand‑new center:

1. **Classes** — add your classes.
2. **Sections** — add sections under each class (you must add at least one class first).
3. **Fee Structure** — set the default charges per class.
4. **Students** — add students (individually or by Excel import).

Each step marks itself complete once the underlying data exists. You can **skip** ("I'll do it later") at any point and finish setup from the individual menu pages instead.

### 6.3 Classes

Create the classes your center teaches.

- **Add a class:** enter a class name (must be unique within your center). An optional display order controls sorting.
- **Edit** a class name or order.
- **Delete** a class — **only allowed when it has no students.** Deleting a class also removes its sections and its fee structure. If students exist, move or remove them first.

### 6.4 Sections

Sections live under a class (e.g. "A", "B", "Morning").

- **Add a section:** choose the class and enter a section name (unique within that class).
- **Edit** a section name.
- **Delete** a section — **only when no students belong to it.**

Sections are optional for a student (a student may have a class but no section).

### 6.5 Fee Structure & Per‑Student Overrides

**Class fee structure.** For each class you can define:

- **Admission fee** and the **month** it is charged.
- **Monthly fee** (the recurring charge).
- **Half‑yearly model test** fee — amount, month, and an on/off toggle.
- **Annual model test** fee — amount, month, and an on/off toggle.
- **Other components** — any number of custom labelled charges, each with an amount and a month.

This structure is the default payable for every student in the class.

**Per‑student, per‑month overrides.** When a student's charge differs for a particular month, set an override:

- A **positive amount** → that becomes the student's payable for that month.
- **0** → the student is **Not Enrolled** that month and is excluded from all payable/due/collection figures.
- **Clear the override** → the student falls back to the class fee structure.

Overrides take effect immediately across all fee calculations and reports (nothing is pre‑stored).

### 6.6 Students

The Students page is a fast, paginated browser (loads more as you scroll) with filters by **class**, **status** (active / inactive / all), and **search**.

**Add / edit a student.** Fields: class (required), section (optional — must belong to the chosen class), name, roll, and phone (the guardian's number used for SMS).

**Activate / deactivate.** Deactivating a student hides them from day‑to‑day modules (student list default, attendance, payment grids) but **preserves all their historical payment and result records**, which still appear in historical reports. Reactivate at any time.

**Delete.** Permanently removes the student record.

**Bulk import from Excel.** Import many students at once from a spreadsheet with columns for **name, roll, phone, class name, and section name**:

- Classes and sections are matched **by name** (case‑insensitive). Any class or section that doesn't exist yet is **created automatically**, so you don't have to pre‑build master data with exact names.
- Rows missing a required field (name, roll, phone, or class) are **skipped**.
- After import you'll see how many students were inserted and how many classes/sections were created.

### 6.7 Attendance

Record daily attendance per class.

1. Choose the **class** and the **date**.
2. Mark each active student **Present** or **Absent**.
3. **Save.**

Only **active** students appear. Saving stores one record per student per (class, date); saving again for the same day updates it.

**Guardian SMS.** Attendance SMS is **off by default** for every center (a deliberate cost control, because a large roll means a large SMS bill each round). When your center has attendance SMS enabled (see **Settings**), saving attendance sends each guardian a Bengali present/absent message. A **Resend SMS** action re‑sends messages for the currently saved state of a day without changing any marks.

### 6.8 Payments

Collect fees for a class, month, and year in a grid.

1. Select **class**, **month**, and **year** (these switch in place without reloading the page).
2. For each student the grid shows the fee **components** and the resolved payable. Enter the **amount paid** and optional **remarks** (a short progress note).
3. **Save** a single row, or **Save all** rows for the class at once.

**Payment status** is derived automatically: **Paid** (paid ≥ total), **Partial** (some paid), or **Unpaid**. If nothing is payable, the row is treated as settled.

**Advance payments are supported.** You may collect **more** than the current month's due. The surplus is not lost — the reporting engine spreads a student's whole paid pool across their enrolled months oldest‑first, so overpayment automatically prepays later months and shows as **Advance** in reports and on receipts.

**SMS on payment**

- **Single‑row Save:** always sends the guardian a Bengali "payment received" message (payment SMS is always on).
- **Save all (bulk):** SMS is **opt‑in**. Only if you tick the send‑SMS option does EduPilot notify guardians — a receipt to whoever paid, and a due reminder to whoever still owes. A routine bulk save sends nothing by default.
- **Resend payment SMS:** re‑send a receipt message for a saved payment.

**Receipts.** From a saved payment you can produce a branded, printable **receipt** (see [§8](#8-printing-receipts--transcripts)) or **share it via WhatsApp** to the guardian's number.

### 6.9 Reports

Two report tabs, both always shown in English.

**Due Report (payments).**
- Filter by **class**, **date range** (From/To), and **status**.
- Shows each student's payable, paid, and due, using the oldest‑first allocation described above.
- View a **summary** of totals, page through results, switch to a **matrix** (pivot) view, or **export to Excel**.

**Attendance Report.**
- Filter by **class** and **date range**.
- Shows per‑student attendance across the number of class days in range.
- **Export to Excel.**

### 6.10 Results (Exams, Marks & Transcripts)

A complete exam‑results workflow. The Results dashboard shows tiles for **Exams in progress**, **Pending marks**, **Awaiting publish**, and **Recently published**, plus buttons for Reports, Subjects, Settings, and Create Exam.

**Prerequisite:** you need at least one **class** and one **subject** before creating an exam. If subjects are missing, the page guides you to add them first.

#### Step 1 — Subjects (master data)

Under **Subjects**, add the subjects taught in each class (e.g. Bangla, Mathematics), with an optional display order. A subject that is used by any exam **cannot be deleted** until it's removed from that exam.

#### Step 2 — Create an Exam

Provide:
- **Class**
- **Exam name**
- **Exam type** (chosen from preset labels — e.g. Class Test, Weekly Test, Monthly Test, Model Test, Half Yearly, Annual — configurable in Settings)
- **Date**
- **Total marks** and **Pass marks** — **per subject** (defaulted from Settings; editable)
- **Subjects included** (at least one; only subjects belonging to the class are accepted)

A new exam starts as a **draft**.

#### Step 3 — Enter Marks

Open the exam's **Mark Entry** screen and enter each student's obtained mark per subject for the whole class. Marks are saved for the entire class in one action (not per keystroke). A blank mark means "not entered / absent" and counts as 0 toward the total. Marks outside the valid range are flagged but never block saving. **Marks can be edited only while the exam is a draft.**

#### Step 4 — Publish

**Publishing** moves the exam from **draft → published** (one‑way) and **locks the marks**. If **notify‑on‑publish** is enabled in Settings, guardians receive a Bengali result‑published SMS (GPA and pass/fail) in a single batch. Publishing is not blocked by SMS problems — the status change always commits.

*You can delete an exam even after publishing; deleting an exam also clears all its marks.*

#### Results & Transcripts

Every figure — per‑subject pass/fail, grand total, percentage, GPA, letter grade, overall pass/fail, and class merit position — is computed live from the marks and your grading settings.

- **Transcript / report card:** print a refined, single‑page **A4** academic transcript per student (landscape by default, portrait available). It includes the marks table, a GPA medallion, merit position, and the grading key, and prints to PDF from your browser's print dialog. You can print one student or a whole class as a multi‑page document.

#### Results Reports

Filter results by class, exam, subject, status, or date range to review performance across the center.

#### Results Settings

Configure the grading engine for your center:

- **Grading scale** — grade bands (grade, minimum %, and GPA point). The Bangladesh‑standard scale (A+ 80, A 70, A‑ 60, B 50, C 40, D 33, F 0) is the default.
- **Pass rule** — **per subject** (must pass every subject) or **overall** (aggregate percentage must reach the pass threshold).
- **Default total / pass marks** — used when creating new exams (defaults 100 / 33).
- **Exam‑type presets** — the labels available in the Create Exam dropdown.
- **Certificate title** — the heading printed on transcripts.
- **Notify on publish** — whether guardians get an SMS when results are published.

A center that never opens Results Settings still gets a fully working default grading scale.

### 6.11 Messages

A private, two‑way channel between your center and the platform (Super Admin). You can only converse with the platform, and only within your own center.

- Send a message to the Super Admin and read their replies.
- Unread replies show as a **badge** in the navigation and top bar.
- Opening the conversation clears your unread badge.
- Older messages load on demand as you scroll up.

### 6.12 Settings

Manage your center and account:

- **Center name** — the name shown throughout your interface (updates the sidebar/top bar).
- **Admin display name** — your own name.
- **Change password** — verify your current password, then set a new one (minimum 6 characters).
- **Attendance SMS toggle** — turn guardian attendance messages on or off for your center. *(Payment SMS on single‑row save is always on and is not controlled here.)*

---

## 7. SMS Notifications

EduPilot sends **Bengali** SMS to guardians for the following events. Messages include your center name, the student's name, and relevant amounts/dates (amounts in Taka, numbers in Bengali numerals).

| Event | When it's sent | On/Off |
|---|---|---|
| **Attendance — Present** | On saving attendance | Off by default per center (Settings) |
| **Attendance — Absent** | On saving attendance | Off by default per center (Settings) |
| **Payment received** | On single‑row payment Save; opt‑in on bulk Save | Payment SMS always on for single Save |
| **Payment due reminder** | Opt‑in on bulk Save (to students who still owe) | Opt‑in |
| **Result published** | On publishing an exam | Controlled by "Notify on publish" in Results Settings |

**About the SMS gateway.** Out of the box, EduPilot uses a **stub** provider that only logs messages (so the app runs at zero cost in development and testing). To send real SMS, the operator configures a real Bangladeshi SMS gateway via environment settings — no changes to the app are needed. Every send is recorded in the center's SMS log.

**Cost note:** Because a large roll means one SMS per student per attendance round, attendance SMS is deliberately **off by default**. Payment SMS on single saves stays on.

---

## 8. Printing: Receipts & Transcripts

EduPilot generates print‑ready documents in your browser — open the document and use **Print / Save as PDF**.

**Payment receipt** (A4 portrait, branded frame):
- Center name, receipt number (auto‑derived from period + roll), student details, fee lines, total, paid, and **Due or Advance**.
- Optional **QR code** to verify the receipt's details.
- Optional **remarks**.
- Can also be **shared to WhatsApp** as a formatted text message (Bangladeshi numbers are normalized automatically).

**Academic transcript / report card** (A4, landscape or portrait):
- One page per student, styled as an institutional diploma.
- Marks table (full marks, obtained, highest, point, grade), grand total, GPA medallion, percentage, **merit position**, pass/fail ribbon, and the grading key.
- Print a single student or an entire class at once.

---

## 9. Installing EduPilot as an App (PWA / Android)

EduPilot is a **Progressive Web App**, so it can be installed like a native app:

- **On phones/desktops:** use your browser's "Install app" / "Add to Home Screen" prompt. An in‑app install prompt may also appear.
- **Android APK:** the operator can package EduPilot as an Android app using a Trusted Web Activity (Bubblewrap) configuration provided with the project. The app is named **EduPilot** and opens to the configured start page.

Once installed, EduPilot runs full‑screen with its own icon and works like any other app on the device.

---

## 10. Security & Data Privacy

- **Complete center isolation.** Every center's data is tagged to that center and every database read/write is automatically scoped to the signed‑in center. One center can never read or modify another's records, even by manipulating a web address.
- **Server‑enforced access.** Roles and permissions are checked on the server for every page and action — not just hidden in the interface.
- **Password protection.** Passwords are stored only as secure hashes (never in plain text). Password changes require the current password; minimum length is 6 characters.
- **Brute‑force lockout.** 5 failed sign‑in attempts lock an account for 15 minutes.
- **Prompt revocation.** Deactivating a center or account ends active sessions within about a minute.
- **Audit trail.** Sensitive platform actions (Clean/Delete Center) are recorded in an append‑only audit log with the actor, target center, and outcome.
- **Safe destructive actions.** Clean and Delete require an exact typed phrase plus the Super Admin's own password, run as all‑or‑nothing transactions, and touch only the targeted center.

---

## 11. Frequently Asked Questions

**I created a center but the admin can't log in.**
Check that the center is **active** and that the admin is using the correct **phone number**, **password**, and the center's **own login address** (`yourdomain/{slug}/login`). After 5 failed attempts the account locks for 15 minutes.

**A student paid extra this month — where did the extra money go?**
Nowhere is lost. Extra payment becomes an **Advance** and automatically prepays the student's upcoming months. You'll see it reflected in the Due Report and on the receipt.

**Why didn't guardians get attendance SMS?**
Attendance SMS is **off by default**. Turn it on in **Settings**. (In test/stub mode, messages are only logged, not actually delivered.)

**I can't delete a class / section.**
Classes and sections can only be deleted when they have **no students**. Move or remove the students first. (Deleting a class also removes its sections and fee structure.)

**I need to fix a mark after publishing results.**
Published exams are **locked**. You can delete the exam (which clears its marks) and recreate it, or plan mark corrections before publishing. Marks are freely editable while an exam is a **draft**.

**A student left the center. Should I delete them?**
Prefer **deactivate** — it hides the student from daily screens while preserving their payment and result history for reports. Delete only when you truly want the record gone.

**What's the difference between Clean Center and Delete Center?**
**Clean** wipes a center's operational data but keeps the center and its admin login (fresh start). **Delete** removes the center entirely, including its login, and frees the slug. Both are Super‑Admin‑only, irreversible, and audit‑logged.

**Can a Platform Admin help run a center?**
No. Platform Admins have **read‑only** console access (dashboard, centers list, marketing student search). Only a Center Admin operates a center, and only a Super Admin manages centers, users, theme, and messaging.

---

## Appendix A — Glossary

- **Tenant:** an isolated center account.
- **Slug:** the address label for a center.
- **Payable:** the amount a student owes for a given month (from the class fee structure or an override).
- **Allocation:** the oldest‑first spreading of a student's paid money across enrolled months.
- **Model test:** a periodic assessment fee (half‑yearly and annual) configurable per class.
- **GPA point:** the numeric value tied to a letter grade in the grading scale.
- **Pass rule:** whether a student must pass every subject or reach an overall percentage.
- **Stub SMS provider:** the default no‑cost mode that logs messages instead of sending them.

## Appendix B — Field Reference

**Center (created by Super Admin):** name, admin name, phone, password (≥6), slug (unique; lowercase letters/digits/hyphens; not a reserved word), active flag, attendance‑SMS flag.

**Platform user:** name, phone, password (≥6), role (Super Admin / Platform Admin), active flag.

**Class:** name (unique per center), display order.

**Section:** class, name (unique per class).

**Fee structure (per class):** admission fee + month, monthly fee, half‑yearly model test (amount/month/enabled), annual model test (amount/month/enabled), other components (label/amount/month).

**Fee override (per student‑month):** payable amount (0 = Not Enrolled; cleared = use class fee).

**Student:** class (required), section (optional), name, roll, phone, active flag.

**Attendance:** class, date, per‑student status (present/absent).

**Payment:** student, class, year, month, fee components, total, paid amount, status (paid/partial/unpaid), remarks.

**Subject:** class, name, order.

**Exam:** class, name, type, date, per‑subject total & pass marks, included subjects, status (draft/published).

**Marks:** per student per exam, obtained mark per subject (blank = absent/not entered).

**Results settings (per center):** grading scale (grade/min %/point), pass rule, default total & pass marks, exam‑type presets, certificate title, notify‑on‑publish.

---

*This manual documents EduPilot exactly as built. For deployment, environment configuration, and developer details, see the project's `README.md`, `RUN_LOCALLY.md`, and `APK_BUILD.md`.*
