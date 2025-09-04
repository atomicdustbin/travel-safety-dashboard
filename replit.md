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
- **Background Scheduler**: Automated data refresh system for keeping travel advisories current

## Database Design
- **Countries Table**: Core country information (name, code, flag URL)
- **Alerts Table**: Travel advisories and security alerts with severity levels
- **Background Info Table**: Demographic and economic country data
- **Relational Structure**: Foreign key relationships linking alerts and background info to countries

## API Structure
- **Search Endpoint**: `/api/search` - Accepts comma-separated country names and returns comprehensive country data
- **RESTful Design**: Clean API design following REST principles
- **Error Handling**: Centralized error handling with appropriate HTTP status codes
- **Request Logging**: Middleware for logging API requests and responses

## Data Management
- **Multi-Source Aggregation**: Combines data from US State Department, UK FCDO, and other travel advisory sources
- **Automatic Refresh**: Scheduled updates every 6 hours for alerts, weekly for background data
- **Caching Strategy**: In-memory storage for development, PostgreSQL for production with query optimization
- **Data Validation**: Zod schemas for runtime type checking and validation

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