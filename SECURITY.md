# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to the repository owner with the following details:

- A description of the vulnerability.
- Steps to reproduce the issue.
- The potential impact.

We will acknowledge your report within 48 hours and work with you to understand and address the issue before any public disclosure.

## Security Practices

This project follows these security practices:

- **No hardcoded secrets**: All sensitive values are loaded from environment variables.
- **JWT authentication**: Tokens are signed with a configurable secret key and expire after a set period.
- **Password hashing**: All passwords are hashed using bcrypt via passlib.
- **Static analysis**: Bandit is run on every commit via CI to detect common security issues.
- **Dependency management**: Dependencies are pinned to specific versions in `requirements.txt`.
- **Non-root Docker**: The backend container runs as a non-root user.

## Default Credentials

The application ships with a default admin account (`admin` / `admin123`) for development convenience. **You must change these credentials before deploying to production.**
