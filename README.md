# ReflectAI & Global Places Tracker

A production-grade, full-stack reflection journal and interactive travel mapping web application powered by **Gemini AI**, **Google Maps Platform**, and **Cloud Firestore**. Every reflection, conversational turn, saved location, and custom itinerary list is cryptographically isolated to the authenticated user's Google account under `/users/{userId}/...` in Firestore.

---

## Application Functions & Feature Catalog

### 1. Reflective Journaling & AI Synthesis
- **Multi-Turn Conversational Journaling**: Engage in meaningful multi-turn dialogue with Gemini to unpack daily reflections, thoughts, and cognitive patterns.
- **Adaptive Reflection Modes**:
  - *Deep Reflection*: Empathetic, introspective analysis connecting past thoughts with current feelings.
  - *Action-Oriented*: Structured, pragmatic breakdowns converting obstacles into concrete steps.
  - *Socratic Questioning*: Thought-provoking inquiry challenging underlying assumptions.
  - *Emotional Decompression*: Safe, validating space for processing stress and emotional fatigue.
- **Executive Summarization & Brainstorming**:
  - One-click *Executive Summary* synthesis condensing journal conversations into structured highlights and key insights.
  - Quick *Brainstorm Action Plan* generating tangible next steps and creative ideas.
- **Persistent Journal History & Search**:
  - Full-text real-time search across past entries, titles, and reflections.
  - Mood tracking and tag organization.
  - Granular delete and edit management with optimistic UI updates.

---

### 2. Interactive Places & Travel Mapping System
- **Dual-Engine Mapping Architecture**:
  - *Primary Map*: Interactive Google Maps Platform (`@vis.gl/react-google-maps`) utilizing `AdvancedMarkerElement`, dynamic pan/zoom animations, and custom InfoWindows.
  - *Zero-Dependency Fallback Map*: Integrated Leaflet and OpenStreetMap canvas activating automatically if no Google Maps API key is configured or when running offline.
- **Multi-Tier Worldwide Search & Geocoding**:
  - Seamless location search powered by Google Places Autocomplete.
  - Multi-tier worldwide fallback geocoder chaining **Google Geocoding REST API** $\rightarrow$ **Photon English Worldwide Geocoder** $\rightarrow$ **OpenStreetMap Nominatim**.
- **AI-Powered English Localization & Script Preservation**:
  - Automatically translates non-English landmark and street names (e.g., Japanese, French, Thai, Chinese, Cyrillic) into standard conversational English for effortless reading.
  - Retains original native script sub-tags (e.g., *"Tokyo Tower"* alongside *"東京タワー"*) for accurate local navigation.
- **Custom Multi-List Place Organization & Thematic Itineraries**:
  - Create unlimited custom lists (e.g., *Food & Cafe Crawl*, *Scenic & Photography*, *Weekend Getaways*).
  - Customizable color themes (Indigo, Emerald, Amber, Rose, Sky, Violet, Teal, Fuchsia) and vector icons (Heart, Coffee, Camera, Compass, Landmark, Utensils, Sun, Bookmark, Pin).
  - Horizontal interactive filter ribbon with real-time per-list place count badges.
  - Quick-move dropdowns on place cards to reassign locations instantly.
- **Visual Status & Categorization**:
  - Categorize by *Nature & Parks*, *Food & Dining*, *Culture & History*, *Shopping*, *Accommodations*, and *Activities*.
  - Mark status as *Want to Visit*, *Visited*, or *Top Favorite* with custom color-coded map pins.
- **Interactive Location Coordinate Picker**:
  - Visual coordinate picker modal with crosshair marker, geocoding address reverse lookup, and manual Latitude/Longitude fine-tuning.
- **Gemini AI Place Recommendations**:
  - Suggests curated destinations based on natural language prompts (e.g., *"Hidden scenic photo spots in Kyoto"* or *"Peaceful coffee shops"*).
  - One-click "Track" button to save AI-recommended places directly to user lists and the interactive map.
- **One-Click Sample Places Generator**:
  - Populates diverse worldwide destinations across Tokyo, Paris, San Francisco, Kyoto, and New York for instant prototyping.

---

### 3. Server-Side API Endpoints Specification

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/gemini/reflect` | `POST` | Executes multi-turn reflection turns and executive summaries with Gemini model fallback. |
| `/api/gemini/suggest-places` | `POST` | Generates structured location recommendations with rationale and coordinates. |
| `/api/places/localize` | `POST` | Translates foreign place names to English while preserving native script names. |
| `/api/places/search` | `GET` | Proxies multi-tier worldwide location search queries. |
| `/api/places/details` | `GET` | Fetches place details and coordinates from Google Places API. |
| `/api/places/geocode` | `GET` | Reverse and forward geocoding with multi-engine fallback. |
| `/api/config/maps-key` | `GET` | Delivers configured Maps Platform client credentials securely. |
| `/api/health` | `GET` | Health check endpoint returning server and service status. |

---

## Architecture & Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Federated Google Sign-In; zero client-stored passwords. |
| **Backend Database** | Cloud Firestore | Owner-isolated document collections (`/users/{userId}/*`). |
| **AI Processing Engine** | Gemini 3.6 Flash / 3.1 Flash-Lite / 3.7 Flash | Multi-turn reflections, executive summaries, brainstorming, and location localization. |
| **Maps & Geo Services** | Google Maps Platform + Leaflet / OSM | Interactive `@vis.gl/react-google-maps` with AdvancedMarkerElement & Nominatim fallback. |
| **Backend Service Layer** | Express.js on Node.js (Full-Stack) | Secure server proxy shielding API credentials and third-party keys from browser clients. |
| **Secret Management** | Google Cloud Secret Manager | Dynamic runtime secret injection for `GEMINI_API_KEY`. |
| **Frontend Framework** | React 18 + Vite + Tailwind CSS | Fluid, responsive user interface with Lucide icons and modern UI components. |

---

## 1. Prerequisites & GCP Configuration

### Enable Google Cloud APIs
Run the following commands using the `gcloud` CLI to enable the necessary Google Cloud services:

```bash
# Set your active GCP project
gcloud config set project YOUR_PROJECT_ID

# Enable Cloud Run, Secret Manager, and Cloud Firestore APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

---

## 2. Secret Management Setup

To ensure zero hardcoded credentials and conform to OWASP Top 10 security standards, store your Gemini API key in Google Cloud Secret Manager:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration (Cloud Firestore)

Deploy the strict, user-isolated Firestore security rules. No unauthenticated reads or cross-user queries are permitted:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /places/{placeId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /lists/{listId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy the rules via the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Google Cloud Run Deployment Flow

Build and deploy the application container to Google Cloud Run:

```bash
# Build and deploy service with Secret Manager binding
gcloud run deploy reflect-ai-service \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port=3000
```

### Mandatory Campaign Labeling
Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update reflect-ai-service \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 5. Agentic Threat Model Summary

| Threat Zone | Risk Scenario | Applied Countermeasure | OWASP Standard |
| :--- | :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection, oversized payloads, XSS | Top-level body parsing ordering, null-safe payload destructuring, text sanitization | OWASP A03 / LLM02 |
| **Planning & Reasoning** | Prompt injection attempting to break reflection persona | Strict system instruction pinning; inputs encapsulated as plain data turns | OWASP LLM01 |
| **Tool Execution** | Unauthorized API proxy access or escalation | Bearer JWT verification required on `/api/gemini/reflect` routes | OWASP A01 |
| **Memory & State** | Cross-user data leaks in Cloud Firestore | Owner-bound path check (`request.auth.uid == userId`); zero insecure defaults; zero-crash `sanitizePayload` stripping `undefined` | OWASP A01 |
| **Inter-System Comm** | API key leakage in browser client bundles | Full-stack server proxy; keys stored exclusively in Secret Manager / env vars | OWASP A02 |

---

## 6. Gemini Resilience Fallback Ladder

The backend service integrates an automated 4-tier fallback ladder wrapped in a reusable helper utility to recover from transient service disruptions and rate limits (`429`, `503`, `500`):
1. **Primary**: `gemini-3.6-flash` (Fast, highly accurate reasoning)
2. **High-Availability Fallback**: `gemini-3.1-flash-lite` (Low-latency backup)
3. **Dynamic Alias**: `gemini-flash-latest` (Continuously updated release alias)
4. **Deep Reasoning Fallback**: `gemini-3.7-flash` (Complex reasoning fallback)

---

## 7. Functional Stability Walkthrough Test Cases

The application includes end-to-end user journeys covering every visible feature:

### Test Case 1: Landing Page & Unauthenticated State
- **Action**: Navigate to `/`.
- **Expected Outcome**: Landing page displays features, security isolation badges, and a "Sign In with Google" button. No private entries or places are accessible.

### Test Case 2: Federated Google Authentication
- **Action**: Click "Sign In with Google" and authenticate.
- **Expected Outcome**: User profile displays in the navigation bar; user is redirected to the private reflection workspace.

### Test Case 3: Reflection Entry Composition & AI Turn
- **Action**: Enter a reflection title and body, select "Deep Reflection" mode, and click "Reflect with Gemini".
- **Expected Outcome**: Spinner appears; Gemini responds with empathetic insights; entry auto-persists to Firestore; "Synced to Firestore" indicator lights green.

### Test Case 4: Executive Summarization & Brainstorming
- **Action**: Click "Summarize" or "Brainstorm" quick action buttons.
- **Expected Outcome**: Gemini synthesizes the current conversation and returns structured highlights or creative ideas.

### Test Case 5: History & User Isolation
- **Action**: Switch to "Past Entries" tab.
- **Expected Outcome**: User's past reflections are listed with mood chips and timestamps. Searching filters entries in real time. Deleting an entry removes it from `/users/{userId}/entries/{id}`.

### Test Case 6: Google Maps Places Navigation & Map Render
- **Action**: Click the "Places to Visit" tab in the top navigation.
- **Expected Outcome**: The interactive Google Map renders with `DEMO_MAP_ID`, displaying the map canvas, navigation controls, and category filter chips.

### Test Case 7: Search and Track Places of Interest
- **Action**: In the search bar, type a destination or click "Add Manually" / "Load Sample Places".
- **Expected Outcome**: Autocomplete or selected destination appears with location coordinates. Clicking "Save Place" persists the location to `/users/{userId}/places/{placeId}` in Firestore with real-time marker placement on the map.

### Test Case 8: Interactive Map Markers & InfoWindow
- **Action**: Click an Advanced Marker pin or a place card from the list.
- **Expected Outcome**: The map smoothly pans to the coordinates and opens an InfoWindow displaying the place title, category, formatted address, personal notes, and a direct Google Maps directions link.

### Test Case 9: Gemini AI Place Recommendations
- **Action**: Click "AI Place Inspiration", enter a theme or city (e.g. "Peaceful nature walk" or "Kyoto"), and click "Generate Place Suggestions".
- **Expected Outcome**: Gemini returns curated place suggestions with reasons. Clicking "Track" adds the place directly to the user's Firestore list and Google Map.

### Test Case 10: Multi-List Place Organization & Filtering
- **Action**: Click "Manage Lists", create a new custom list (e.g., "Favorite Cafes" with Amber color and Coffee icon), and assign a place to it.
- **Expected Outcome**: The list appears in the horizontal ribbon with an updated item counter badge; selecting the list filters places and map pins exclusively to that collection.

### Test Case 11: English Localization & Native Text Retention
- **Action**: Search for or manually add a foreign landmark (e.g. "東京タワー" or "Tour Eiffel").
- **Expected Outcome**: The app automatically displays the clean English localized title ("Tokyo Tower") with an accessible native language sub-tag ("東京タワー"), preserving both scripts cleanly.

### Test Case 12: Manual Place Edit & Coordinate Fine-Tuning
- **Action**: Click "Edit" on any saved place card.
- **Expected Outcome**: The edit modal opens with pre-populated fields; modifying the name, coordinates, category, notes, or assigned list updates Firestore in real time with instant map synchronization.

### Test Case 13: Pin Location in Reflection Workspace Journal
- **Action**: In the Reflection Workspace ("Reflection" tab), click "Pin Location" next to the Title and Mode controls.
- **Expected Outcome**: The Pin Location Modal opens with options for Search, Current Device GPS, and Saved Places. Selecting a destination pins it to the active reflection session with an interactive coordinate card, map preview link, and auto-populated tags. Saving the journal entry persists the `location` data object to `/users/{userId}/entries/{entryId}` in Firestore.

### Test Case 14: Secure Google Maps Key Retrieval & Fallback Architecture
- **Action**: Open DevTools Network tab and navigate to "Places to Visit".
- **Expected Outcome**: Client fetches configuration via `/api/config/maps` and routes geocoding/search queries through server-side proxies (`/api/places/*`). Zero private API secret keys or service accounts are exposed in the client HTML or bundle.

### Test Case 15: Strong Monitoring, Structured Logging & Key Rotation Verification
- **Action**: Click "Health & Logs" in the top navigation bar or the footer link "Live Monitoring & Key Rotation".
- **Expected Outcome**:
  1. The **System Health & Live Monitoring** dashboard opens with real-time server uptime, success rate, and active API metrics.
  2. In the "Rotated Key Verification" tab, clicking **Verify Rotated Keys Now** sends a live round-trip ping to the Gemini client and Maps proxy, displaying latency in ms, active model ladder resolution, and masked secret status (`AIza...`).
  3. In the "Gemini Fallback Ladder" tab, verify call counts and success rates across `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, and `gemini-3.7-flash`.
  4. In the "Audit Logs" tab, verify structured JSON log entries detailing request IDs, latency metrics, HTTP status codes, and category tags (`[http]`, `[gemini]`, `[maps]`, `[rotation]`).

