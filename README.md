# 🪵 Ecowoods App – Complete Hardwood Flooring Job Management Platform

[![Expo](https://img.shields.io/badge/Expo-54.0.33-blue.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61dafb.svg)](https://reactnative.dev)
[![Python](https://img.shields.io/badge/Python-3.11%20|%203.12%20|%203.13-yellow.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-green.svg)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-✓-blue.svg)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Ecowoods App** is a full‑stack, production‑ready solution for hardwood flooring businesses. It streamlines the entire job lifecycle—from customer job requests and estimates to bidding, scheduling, and administrative oversight. The system consists of a **React Native (Expo) mobile app** for customers and field staff, a **Python FastAPI backend**, a **PostgreSQL database**, and a **lightweight admin dashboard**—all containerised with Docker for effortless deployment.

> 🚀 **Live demo?** Not yet – but you can run the entire stack locally in minutes!

---

## ✨ Key Features

### 👤 Customer / User
- **User authentication** – Register, login, and manage profile.
- **Job request wizard** – Select services (hardwood installation, repair, staining, etc.), specify details (size, wood type, color, property type, demolition, subfloor, timeframe).
- **Real‑time estimates** – Submit a request and receive a preliminary estimate.
- **Calendar view** – See scheduled appointments and job status.

### 👨‍💼 Admin / Staff (Dashboard)
- **View all job requests** – Filter, sort, and search.
- **Create and manage bids** – Assign managers, set bid values, timeframes.
- **Bid table (laden)** – Overview of all bids with colour‑coded statuses.
- **Schedule jobs** – Drag‑and‑drop calendar (connected to mobile app).
- **Export data** – Generate printable TXT reports for each job row.

### 🔧 Technical Highlights
- **Cross‑platform mobile app** – Built with Expo, runs on iOS, Android, and web.
- **Robust backend** – FastAPI with JWT authentication, SQLAlchemy, and Alembic migrations.
- **Admin dashboard** – Simple, responsive HTML/JS interface (easily replaceable with React/Vue).
- **Dockerised** – One‑command startup for the entire stack (backend, database, dashboard).
- **Python 3.11–3.13 compatible** – Choose your preferred version.
- **Extensible architecture** – Easy to add payment gateways, push notifications, or integrate with CRMs.

---

## 📸 Screenshots

| Mobile App | Admin Dashboard | Calendar |
|------------|-----------------|----------|
| *[Placeholder: add your own screenshots]* | *[Placeholder]* | *[Placeholder]* |

---

## 🛠️ Technology Stack

| Layer          | Technology                                                                 |
|----------------|----------------------------------------------------------------------------|
| Mobile         | React Native (Expo SDK 54), React Navigation, React Native Calendars       |
| Backend        | Python 3.11+, FastAPI, SQLAlchemy, Pydantic, python‑jose, passlib          |
| Database       | PostgreSQL 15 (Docker)                                                     |
| Dashboard      | Vanilla JavaScript, Bootstrap 5 (or replace with your favourite framework) |
| Container      | Docker, Docker Compose                                                      |
| Deployment     | EAS Build (mobile), any cloud (AWS, GCP, DigitalOcean) for backend         |

---

## 📁 Project Structure

```
ecowoods-app/
├── mobile/                  # React Native Expo app
│   ├── src/
│   ├── App.js
│   ├── app.json
│   └── package.json
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/             # route handlers
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── core/            # config, security, database
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── dashboard/               # Admin web interface
│   ├── index.html
│   ├── style.css
│   └── script.js
├── docker-compose.yml       # Orchestrates all services
├── .env.example             # Environment variables template
├── README.md
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/#expo-cli) (`npm install -g expo-cli`)
- [Python](https://python.org/) (3.11–3.13)
- [Docker](https://docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- (Optional) [PostgreSQL](https://postgresql.org/) if running without Docker

### Installation

#### 1. Clone the repository
```bash
git clone https://github.com/iceccarelli/ecowoods-app.git
cd ecowoods-app
```

#### 2. Set up environment variables
Copy `.env.example` to `.env` in the backend folder and adjust values:
```bash
cp backend/.env.example backend/.env
```

#### 3. Run the entire stack with Docker (easiest)
```bash
docker-compose up --build
```
This will start:
- PostgreSQL on `localhost:5432`
- FastAPI backend on `http://localhost:8000` (auto‑reload enabled)
- Admin dashboard on `http://localhost:3000` (served via a simple HTTP server)

#### 4. Run the mobile app
In a separate terminal:
```bash
cd mobile
npm install
expo start
```
Scan the QR code with Expo Go (Android) or Camera (iOS) to run the app on your device, or press `i` for iOS simulator / `a` for Android emulator.

---

## 📱 Mobile App Configuration

The mobile app is pre‑configured to connect to the backend at `http://localhost:8000` (when running on the same machine). For physical devices, update `API_BASE_URL` in `mobile/src/config.js` to your local IP address (e.g., `http://192.168.1.10:8000`).

---

## 🐍 Backend API Documentation

Once the backend is running, interactive API docs are available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Main Endpoints

| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | `/api/auth/register`         | Register a new user             |
| POST   | `/api/auth/login`            | Login, returns JWT              |
| GET    | `/api/users/me`              | Get current user profile        |
| POST   | `/api/job-requests`          | Create a new job request        |
| GET    | `/api/job-requests`          | List all job requests (admin)   |
| GET    | `/api/job-requests/{id}`     | Get a specific request          |
| POST   | `/api/bids`                  | Submit a bid for a request      |
| GET    | `/api/bids`                  | List bids (filterable)          |
| ...    | ...                          | ...                             |

---

## 🧪 Testing

- **Backend**: Run `pytest` inside the backend container or virtual environment.
- **Mobile**: `npm test` (Jest) – tests are located in `mobile/__tests__/`.
- **Dashboard**: Manual testing for now – contributions welcome!

---

## 📦 Deployment

### Mobile App (Expo / EAS Build)
1. Install EAS CLI: `npm install -g eas-cli`
2. Configure `eas.json` and `app.json` (already provided).
3. Run `eas build -p android --profile preview` (or `production`).
4. Follow the EAS prompts to upload to stores.

### Backend & Dashboard
- **With Docker**: The `docker-compose.yml` is production‑ready. Use a reverse proxy (like Nginx) for SSL and domain binding.
- **Without Docker**: Deploy the FastAPI app with Gunicorn + Uvicorn workers behind a process manager. Example:
  ```bash
  pip install gunicorn
  gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
  ```
- **Database**: Use a managed PostgreSQL service (AWS RDS, DigitalOcean Managed DB) or run your own.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact & Support

- **GitHub Issues**: [Report a bug](https://github.com/iceccarelli/ecowoods-app/issues)
- **Email**: ecowoodshardwood@yahoo.com
- **Website**: [ecowoodshardwood.com](http://www.ecowoodshardwood.com)

---

## 🌟 Acknowledgements

- Expo team for the amazing Snack environment.
- All contributors who help improve this platform.

---

**Happy building!** 🪵📱
