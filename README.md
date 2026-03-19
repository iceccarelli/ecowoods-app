# EcoWoods Hardwood Flooring Platform

A complete, production-ready job management platform for hardwood flooring companies. This system includes a polished React Native mobile app for clients, a robust Python FastAPI backend, a web-based admin dashboard for staff, and full Docker containerization for easy deployment.

## 🌟 Features

### Mobile App (React Native / Expo)
- **User Authentication**: Secure login and registration with JWT.
- **Job Requests**: Multi-step form to request flooring services (installation, refinishing, etc.) with detailed specifications (wood type, size, timeframe).
- **Estimates & Bids**: View submitted job requests and track incoming bids/estimates.
- **Calendar**: Interactive calendar to view scheduled jobs, meetings, and deadlines.
- **Profile Management**: Update personal information and contact details.
- **State Management**: Centralized state using Zustand for smooth data flow.

### Backend API (Python FastAPI)
- **RESTful Architecture**: Clean, documented API endpoints.
- **Authentication**: JWT-based secure authentication.
- **Database**: Asynchronous PostgreSQL integration using SQLAlchemy 2.0.
- **Data Validation**: Strict request/response validation using Pydantic.
- **Migrations**: Database schema management with Alembic.
- **Python Support**: Compatible with Python 3.11, 3.12, and 3.13.

### Admin Dashboard (Web)
- **Overview**: Real-time statistics on job requests, bids, and users.
- **Job Management**: View, filter, and update the status of all client job requests.
- **Bid Management**: Create and manage bids/estimates for specific job requests.
- **Calendar Management**: Schedule and manage events, linking them to specific jobs.
- **User Management**: View registered users and manage admin privileges.

---

## 🚀 Quick Start (Docker)

The easiest way to run the backend, database, and admin dashboard is using Docker Compose.

### Prerequisites
- Docker and Docker Compose installed on your machine.

### Steps
1. Open a terminal in the root directory of this project.
2. Run the startup script:
   ```bash
   ./scripts/start.sh
   ```
   *(Alternatively, run `docker compose up --build -d`)*

3. The services will be available at:
   - **API Base URL**: `http://localhost:8000/api/v1`
   - **API Documentation (Swagger)**: `http://localhost:8000/docs`
   - **Admin Dashboard**: `http://localhost:8000/admin/`

4. **Default Admin Credentials**:
   - Username: `admin`
   - Password: `admin123`

To stop the services, run `./scripts/stop.sh` or `docker compose down`.

---

## 📱 Running the Mobile App

The mobile app is built with React Native and Expo.

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app installed on your iOS or Android device (for physical device testing)

### Steps
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the API URL:
   - Open `frontend/services/api.js`
   - Update `API_BASE_URL` to point to your backend.
   - *Note: If testing on a physical device, change `localhost` to your computer's local IP address (e.g., `http://192.168.1.X:8000/api/v1`).*

4. Start the Expo development server:
   ```bash
   npm start
   ```

5. Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android) to run the app.

### Building for Production (EAS Build)
To build standalone `.apk` (Android) or `.ipa` (iOS) files:
1. Install EAS CLI: `npm install -g eas-cli`
2. Login to Expo: `eas login`
3. Configure the project: `eas build:configure`
4. Build for Android: `eas build -p android --profile preview`
5. Build for iOS: `eas build -p ios --profile preview`

---

## 🛠️ Manual Backend Setup (Without Docker)

If you prefer to run the backend locally without Docker:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up your PostgreSQL database and update the `DATABASE_URL` in `.env`.

5. Run database migrations:
   ```bash
   alembic upgrade head
   ```

6. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

## 📁 Project Structure

```text
ecowoods-app/
├── admin-dashboard/       # Vanilla JS/HTML/CSS admin interface
│   ├── css/               # Stylesheets
│   ├── js/                # API client and app logic
│   └── index.html         # Main dashboard entry point
├── backend/               # Python FastAPI backend
│   ├── app/               # Application code (API, models, schemas)
│   ├── migrations/        # Alembic database migrations
│   ├── Dockerfile         # Backend container definition
│   └── requirements.txt   # Python dependencies
├── frontend/              # React Native / Expo mobile app
│   ├── assets/            # Images and icons
│   ├── context/           # Zustand state management
│   ├── screens/           # UI screens
│   ├── services/          # API communication
│   └── App.js             # Navigation and entry point
├── scripts/               # Helper scripts for Docker
└── docker-compose.yml     # Multi-container orchestration
```

---

## 🔒 Security Notes
- The default `.env` files contain placeholder secrets. **You must change `SECRET_KEY` and database passwords before deploying to production.**
- The admin dashboard is currently served statically by the FastAPI backend for convenience. In a strict production environment, consider serving it via Nginx or a CDN.

## 🤝 Extensibility
- **Database**: Currently uses PostgreSQL. Can be swapped to MySQL or SQLite by changing the SQLAlchemy URL in `.env`.
- **Payments**: The `Bid` model is ready to be integrated with Stripe or Square. You can add a payment endpoint in the backend and a checkout screen in the frontend.
