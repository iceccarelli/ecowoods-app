# Contributing to EcoWoods

We welcome contributions from the community. Whether you are fixing a bug, improving documentation, or proposing a new feature, your effort is appreciated.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ecowoods-app.git
   cd ecowoods-app
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install ruff black bandit[toml] pytest pytest-asyncio httpx aiosqlite
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Code Quality

Before submitting a pull request, please ensure the following checks pass locally:

```bash
# Lint
ruff check backend/ --config backend/pyproject.toml

# Format
black --check --config backend/pyproject.toml backend/

# Security
bandit -r backend/app/ -c backend/pyproject.toml

# Tests
cd backend && pytest tests/ -v
```

All of these checks run automatically in CI on every push and pull request.

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Write clear, descriptive commit messages.
3. Open a pull request against the `main` branch.
4. Describe what your change does and why it is needed.
5. Wait for all CI checks to pass before requesting a review.

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with a clear description and steps to reproduce (if applicable).

## Code of Conduct

Be respectful. We are building something useful together, and every contribution matters.

Thank you for helping improve EcoWoods.
