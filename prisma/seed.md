# Database Seed Script

## Usage

Run the seed script to populate your database with sample data:

```bash
npm run prisma:seed
```

Or directly:

```bash
npx ts-node prisma/seed.ts
```

## What Gets Created

- **1 Admin User**
  - Email: `admin@example.com`
  - Password: `admin123`
  - Role: ADMIN

- **1 Test User**
  - Email: `user@example.com`
  - Password: `user123`
  - Role: USER

- **8 Categories**
  - Data Structures
  - Algorithms
  - Backend Development
  - Frontend Development
  - System Design
  - JavaScript
  - TypeScript
  - Node.js

- **20 Tags**
  - Array, Linked List, Tree, Graph
  - Dynamic Programming, Sorting, Searching
  - React, Next.js, NestJS
  - PostgreSQL, Redis
  - REST API, GraphQL
  - Authentication, JWT
  - TypeScript, JavaScript
  - Performance, Best Practices

- **5 Sample Blog Posts**
  1. Introduction to Data Structures
  2. Understanding Big O Notation
  3. Building REST APIs with NestJS
  4. React Hooks: useState and useEffect
  5. System Design: Load Balancing Strategies

## Notes

- The script uses `upsert` to avoid duplicates
- You can run it multiple times safely
- All posts are published and have sample content
- Posts are linked to categories and tags

