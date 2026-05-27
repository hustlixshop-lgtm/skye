Overview ->
Skye is a secure, real-time gig marketplace platform built to streamline the connection between service posters and contractors. The application features a robust escrow-based payment system, integrated real-time chat, and a sophisticated internal agent pipeline (Milo) that provides users with transparent telemetry on request processing.

Tech Stack ->
Frontend: React (Vite), TypeScript, Tailwind CSS.

Backend/Database: Supabase (PostgreSQL, Auth, Realtime).

State Management: Custom useAppState hook for centralized, reactive business logic across the application lifecycle.

Icons & UI: Lucide React for consistent iconography and modular component design.

Technical Highlights ->
1. Centralized State Management (useAppState)
To ensure data consistency (especially regarding financial balances and gig statuses), I implemented a unified custom hook. This acts as a single source of truth for the entire application, handling:

Authentication State: Seamlessly managing session persistence.

Wallet Transactions: Managing the complex flow of funds between users, ensuring accurate balance calculations and transaction history logging.

Global Actions: Centralizing critical operations like finishAndPayMatch, ensuring database consistency between the payer and payee.

2. Escrow & Wallet Logic
The platform implements a secure, trust-minimized escrow system. Money is held by the application upon match creation and released only upon completion.

The finishAndPayMatch function atomizes the financial workflow: validating participants, updating balances in the database, and logging immutable transaction records for both parties simultaneously.

3. Agent Pipeline Telemetry
To improve user trust during complex backend processes, I developed the TelemetryCard component. This provides a visual "pipeline" view for the user, mimicking an agent's internal thought process. It uses a custom useEffect cleanup pattern to prevent memory leaks and ensure the UI state stays synced with asynchronous events.

Features ->
Gig Matching: Post jobs, apply, and match with contractors.

Wallet System: Real-time balance updates, deposit capabilities, and transaction history.

Escrow Protection: Status-based gig tracking to ensure funds are released only when work is verified.

Real-time Chat: Seamless communication between matched users.

How to Run Locally ->
Clone the repository:

git clone https://github.com/hustlixshop-lgtm/skye.git
cd skye

Install dependencies:
npm install

Configure Environment Variables:
Create a .env file in the root directory and add your Supabase credentials:

VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key

Start the development server:
npm run dev
