# After-Sales Service Platform (SAV)

A modern, real-time after-sales service and warranty management platform built with Laravel, React, and WebSockets.

## 🏗️ Architecture

```
after-sales-platform/
├── backend/                 # Laravel 12 API
├── frontend/               # React + TypeScript
├── docker/                 # Docker configurations
└── docs/                   # Documentation
```

## 🛠️ Tech Stack

### Backend
- **Framework**: Laravel 12
- **Real-time**: Laravel Reverb (WebSockets)
- **API**: RESTful + WebSocket events
- **Database**: MySQL 8.0
- **Queue**: Redis (async jobs)
- **Authentication**: Laravel Sanctum (SPA)

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **Charts**: ApexCharts
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Socket.io-client

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx
- **Database**: MySQL 8.0
- **Cache**: Redis
- **Queue Worker**: Laravel Horizon (optional)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- PHP 8.3+ (for backend development)

### Development Setup

```bash
# Clone and setup
git clone <repo>
cd after-sales-platform

# Start all services
docker-compose up -d

# Backend setup
cd backend
docker-compose exec app php artisan migrate:fresh --seed

# Frontend setup
cd ../frontend
npm install
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **WebSocket**: ws://localhost:8080 (Reverb)
- **MySQL**: localhost:3306
- **Redis**: localhost:6379

## 📋 Core Features

### Service Management
- Service request creation and tracking
- Real-time status updates
- Service history and timeline
- Document attachments

### Warranty Management
- Warranty registration
- Claim processing
- Coverage verification
- Warranty timeline tracking

### Technician Management
- Assignment and scheduling
- Location tracking (real-time)
- Performance metrics
- Availability management

### Customer Portal
- Self-service ticket creation
- Real-time status tracking
- Document upload/download
- Communication history

### Analytics & Reporting
- Service metrics dashboard
- Performance analytics
- Response time analysis
- Customer satisfaction reports

## 🔐 Security

- CORS configuration for SPA
- CSRF protection
- Rate limiting
- Input validation & sanitization
- SQL injection prevention (ORM)
- XSS protection

## 📦 Database Schema

Key entities:
- Users (Customers, Technicians, Admins)
- Services (Requests, History, Status)
- Warranties (Registration, Claims, Coverage)
- Products (Serial numbers, Purchase info)
- Documents (Attachments, Reports)
- Notifications (Real-time events)

## 🔄 Real-time Features

- Live service status updates
- Technician location tracking
- Instant notifications
- Live chat support
- Collaborative dashboards

## 📚 Documentation

- [Backend Setup Guide](./docs/backend-setup.md)
- [Frontend Setup Guide](./docs/frontend-setup.md)
- [API Documentation](./docs/api.md)
- [WebSocket Events](./docs/websocket-events.md)
- [Deployment Guide](./docs/deployment.md)

## 📄 License

MIT
