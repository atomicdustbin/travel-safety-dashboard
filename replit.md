# Overview

This is a Global Travel Advisory application that aggregates travel alerts and country information from various sources. The application allows users to search for countries and view current travel advisories, security alerts, and background information including demographics, economy, and cultural details. It's built as a full-stack web application with a React frontend and Express.js backend, using PostgreSQL for data persistence.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Single-page application using React 18 with TypeScript for type safety
- **Vite Build System**: Modern build tooling for fast development and optimized production builds
- **Routing**: Client-side routing using Wouter library for lightweight navigation
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: Shadcn/ui component library built on Radix UI primitives with Tailwind CSS for styling
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

## Backend Architecture
- **Express.js Server**: RESTful API server with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations with PostgreSQL
- **Data Storage**: Abstracted storage interface supporting both in-memory (development) and PostgreSQL (production)
- **Data Fetching Services**: Modular services for fetching data from external travel advisory APIs
- **Background Scheduler**: Automated data refresh system with three schedules:
  - Alerts refresh: Every 6 hours for recently accessed countries
  - Background data refresh: Every 7 days for country metadata
  - **Weekly Bulk Download**: Every Sunday at 1 AM for all US State Department advisories (200+ countries)
- **Bulk Download Service**: Manages large-scale data downloads with progress tracking, error recovery, and concurrency control

## Database Design
- **Countries Table**: Core country information (name, code, flag URL)
- **Alerts Table**: Travel advisories and security alerts with severity levels, includes AI-enhanced fields (keyRisks, safetyRecommendations, specificAreas)
- **Background Info Table**: Demographic and economic country data
- **Bulk Jobs Table**: Tracks weekly download jobs with progress metrics, status, and error logs
- **Relational Structure**: Foreign key relationships linking alerts and background info to countries

## API Structure
- **Search Endpoint**: `/api/search` - Accepts comma-separated country names and returns comprehensive country data
- **PDF Export**: `/api/export/pdf` - Generates formatted PDF reports with AI-enhanced travel advisories
- **Bulk Download Management**:
  - `POST /api/refresh-advisories` - Manually trigger bulk download of all US State Dept advisories
  - `GET /api/refresh-status/:jobId` - Check progress of running or completed bulk download jobs
  - `GET /api/refresh-history` - View history of past bulk download jobs
  - `POST /api/refresh-cancel/:jobId` - Cancel a running bulk download job
- **RESTful Design**: Clean API design following REST principles
- **Error Handling**: Centralized error handling with appropriate HTTP status codes
- **Request Logging**: Middleware for logging API requests and responses

## Data Management
- **Multi-Source Aggregation**: Combines data from US State Department, UK FCDO, and other travel advisory sources
- **Automatic Refresh**: Three-tier scheduling system:
  - Recently accessed countries: Every 6 hours
  - Background metadata: Every 7 days
  - **Complete US State Dept database**: Weekly (Sundays at 1 AM) with AI enhancement for all 200+ countries
- **AI Enhancement**: ChatGPT integration analyzes full advisory pages to extract key risks, safety recommendations, and specific areas of concern
- **Persistent Caching Strategy**:
  - All downloaded data stored in PostgreSQL cloud database for persistence
  - Search queries check cached data first, only fetch online if no cache exists
  - Automatic storage selection: PostgreSQL when DATABASE_URL exists, in-memory for local dev
  - Cache-first approach ensures fast response times and reduced API calls
- **Data Validation**: Zod schemas for runtime type checking and validation
- **Progress Tracking**: Real-time progress monitoring for bulk downloads with error recovery and job persistence

# External Dependencies

## Database
- **Neon PostgreSQL**: Serverless PostgreSQL database for production deployment
- **Drizzle Kit**: Database migration and schema management tools

## UI Components
- **Radix UI**: Headless component primitives for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide Icons**: Icon library for consistent visual elements

## Data Sources
- **US State Department Travel Advisories API**: Official US government travel warnings and alerts
- **UK FCDO Travel Advice API**: British government foreign travel guidance
- **REST Countries API**: Country metadata including flags, demographics, and basic information
- **World Bank API**: Economic data and development indicators

## Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast bundling for production server builds
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility
- **Replit Integration**: Development environment optimizations and error handling