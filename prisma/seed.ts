import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create Categories
  const categories = [
    {
      name: 'Data Structures',
      slug: 'data-structures',
      description: 'Learn about arrays, linked lists, trees, graphs, and more',
    },
    {
      name: 'Algorithms',
      slug: 'algorithms',
      description: 'Sorting, searching, dynamic programming, and algorithm design',
    },
    {
      name: 'Backend Development',
      slug: 'backend-development',
      description: 'Server-side programming, APIs, databases, and architecture',
    },
    {
      name: 'Frontend Development',
      slug: 'frontend-development',
      description: 'React, Next.js, UI/UX, and client-side technologies',
    },
    {
      name: 'System Design',
      slug: 'system-design',
      description: 'Scalable systems, distributed systems, and architecture patterns',
    },
    {
      name: 'JavaScript',
      slug: 'javascript',
      description: 'JavaScript fundamentals, ES6+, and modern JavaScript features',
    },
    {
      name: 'TypeScript',
      slug: 'typescript',
      description: 'TypeScript basics, advanced types, and best practices',
    },
    {
      name: 'Node.js',
      slug: 'nodejs',
      description: 'Node.js development, Express, NestJS, and server-side JavaScript',
    },
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    createdCategories.push(category);
    console.log(`✅ Category created: ${category.name}`);
  }

  // Create Tags
  const tags = [
    { name: 'Array', slug: 'array' },
    { name: 'Linked List', slug: 'linked-list' },
    { name: 'Tree', slug: 'tree' },
    { name: 'Graph', slug: 'graph' },
    { name: 'Dynamic Programming', slug: 'dynamic-programming' },
    { name: 'Sorting', slug: 'sorting' },
    { name: 'Searching', slug: 'searching' },
    { name: 'React', slug: 'react' },
    { name: 'Next.js', slug: 'nextjs' },
    { name: 'NestJS', slug: 'nestjs' },
    { name: 'PostgreSQL', slug: 'postgresql' },
    { name: 'Redis', slug: 'redis' },
    { name: 'REST API', slug: 'rest-api' },
    { name: 'GraphQL', slug: 'graphql' },
    { name: 'Authentication', slug: 'authentication' },
    { name: 'JWT', slug: 'jwt' },
    { name: 'TypeScript', slug: 'typescript' },
    { name: 'JavaScript', slug: 'javascript' },
    { name: 'Performance', slug: 'performance' },
    { name: 'Best Practices', slug: 'best-practices' },
  ];

  const createdTags = [];
  for (const tag of tags) {
    const createdTag = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
    createdTags.push(createdTag);
    console.log(`✅ Tag created: ${createdTag.name}`);
  }

  // Create Sample User
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Test User',
      password: userPassword,
      role: 'USER',
    },
  });
  console.log('✅ Test user created:', user.email);

  // Create Sample Posts
  const samplePosts = [
    {
      title: 'Introduction to Data Structures',
      slug: 'introduction-to-data-structures',
      excerpt: 'Learn the fundamentals of data structures and why they are essential for efficient programming.',
      content: `# Introduction to Data Structures

Data structures are fundamental building blocks in computer science. They help us organize and store data efficiently, making our programs faster and more reliable.

## What are Data Structures?

Data structures are ways of organizing and storing data in a computer so that it can be accessed and modified efficiently. Different data structures are suited to different kinds of applications.

## Common Data Structures

### Arrays
Arrays are the simplest data structure. They store elements in contiguous memory locations.

\`\`\`javascript
const arr = [1, 2, 3, 4, 5];
\`\`\`

### Linked Lists
Linked lists consist of nodes where each node contains data and a reference to the next node.

### Trees
Trees are hierarchical data structures with a root node and child nodes.

## Conclusion

Understanding data structures is crucial for writing efficient code. Choose the right data structure for your use case.`,
      categoryId: createdCategories.find(c => c.slug === 'data-structures')?.id,
      published: true,
      readingTime: 5,
      views: 150,
      metaTitle: 'Introduction to Data Structures - Learn Programming',
      metaDescription: 'Comprehensive guide to data structures for beginners. Learn arrays, linked lists, trees, and more.',
      metaKeywords: 'data structures, programming, arrays, linked lists',
    },
    {
      title: 'Understanding Big O Notation',
      slug: 'understanding-big-o-notation',
      excerpt: 'Master Big O notation to analyze algorithm efficiency and make better programming decisions.',
      content: `# Understanding Big O Notation

Big O notation is a mathematical way to describe the performance of an algorithm. It helps us understand how an algorithm's runtime or space requirements grow as input size increases.

## What is Big O?

Big O notation describes the worst-case scenario for how an algorithm performs. It's written as O(f(n)), where f(n) is a function that describes the growth rate.

## Common Time Complexities

### O(1) - Constant Time
Operations that take the same time regardless of input size.

\`\`\`javascript
function getFirst(arr) {
  return arr[0]; // Always takes the same time
}
\`\`\`

### O(n) - Linear Time
Operations that scale linearly with input size.

\`\`\`javascript
function findMax(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}
\`\`\`

### O(log n) - Logarithmic Time
Operations that divide the problem in half each time.

### O(n²) - Quadratic Time
Operations that require nested loops.

## Conclusion

Understanding Big O helps you write more efficient code and make better algorithmic choices.`,
      categoryId: createdCategories.find(c => c.slug === 'algorithms')?.id,
      published: true,
      readingTime: 8,
      views: 230,
      metaTitle: 'Big O Notation Explained - Algorithm Complexity',
      metaDescription: 'Learn Big O notation to analyze algorithm efficiency. Understand time and space complexity.',
      metaKeywords: 'big o notation, algorithms, complexity, performance',
    },
    {
      title: 'Building REST APIs with NestJS',
      slug: 'building-rest-apis-with-nestjs',
      excerpt: 'Learn how to build scalable and maintainable REST APIs using NestJS framework.',
      content: `# Building REST APIs with NestJS

NestJS is a progressive Node.js framework for building efficient and scalable server-side applications. It uses TypeScript and follows the modular architecture pattern.

## Why NestJS?

- **TypeScript First**: Built with TypeScript for better type safety
- **Modular Architecture**: Organize code into modules
- **Dependency Injection**: Built-in DI container
- **Decorators**: Use decorators for clean, declarative code

## Setting Up a NestJS Project

\`\`\`bash
npm i -g @nestjs/cli
nest new my-api
\`\`\`

## Creating a Controller

\`\`\`typescript
import { Controller, Get } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return 'This returns all users';
  }
}
\`\`\`

## Creating a Service

\`\`\`typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    return [{ id: 1, name: 'John' }];
  }
}
\`\`\`

## Conclusion

NestJS provides a solid foundation for building enterprise-grade applications with clean architecture and best practices.`,
      categoryId: createdCategories.find(c => c.slug === 'backend-development')?.id,
      published: true,
      readingTime: 10,
      views: 180,
      metaTitle: 'Building REST APIs with NestJS - Complete Guide',
      metaDescription: 'Learn to build REST APIs with NestJS. Complete guide with examples and best practices.',
      metaKeywords: 'nestjs, rest api, nodejs, backend, typescript',
    },
    {
      title: 'React Hooks: useState and useEffect',
      slug: 'react-hooks-usestate-useeffect',
      excerpt: 'Master the two most important React hooks: useState for state management and useEffect for side effects.',
      content: `# React Hooks: useState and useEffect

React Hooks revolutionized how we write React components. They allow us to use state and lifecycle methods in functional components.

## useState Hook

The useState hook lets you add state to functional components.

\`\`\`javascript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

## useEffect Hook

The useEffect hook lets you perform side effects in functional components.

\`\`\`javascript
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  if (!user) return <div>Loading...</div>;

  return <div>{user.name}</div>;
}
\`\`\`

## Best Practices

1. Always include dependencies in the dependency array
2. Clean up side effects when component unmounts
3. Use multiple useEffect hooks for different concerns

## Conclusion

Hooks make React code more reusable and easier to understand. Master these two hooks and you'll be well on your way to becoming a React expert.`,
      categoryId: createdCategories.find(c => c.slug === 'frontend-development')?.id,
      published: true,
      readingTime: 7,
      views: 320,
      metaTitle: 'React Hooks Tutorial - useState and useEffect',
      metaDescription: 'Learn React Hooks: useState and useEffect. Complete tutorial with examples and best practices.',
      metaKeywords: 'react, hooks, useState, useEffect, frontend',
    },
    {
      title: 'System Design: Load Balancing Strategies',
      slug: 'system-design-load-balancing',
      excerpt: 'Explore different load balancing strategies to distribute traffic efficiently across multiple servers.',
      content: `# System Design: Load Balancing Strategies

Load balancing is a critical component of scalable system architecture. It distributes incoming network traffic across multiple servers to ensure no single server is overwhelmed.

## Why Load Balancing?

- **High Availability**: If one server fails, traffic routes to others
- **Performance**: Distribute load to prevent bottlenecks
- **Scalability**: Add more servers as traffic grows

## Load Balancing Algorithms

### Round Robin
Distributes requests sequentially across servers.

### Least Connections
Routes traffic to the server with the fewest active connections.

### IP Hash
Uses client IP to determine which server handles the request.

### Weighted Round Robin
Assigns weights to servers based on capacity.

## Load Balancer Types

### Layer 4 (Transport Layer)
Routes based on IP and port.

### Layer 7 (Application Layer)
Routes based on HTTP headers, URLs, and cookies.

## Implementation Example

\`\`\`javascript
// Simple round-robin load balancer
class LoadBalancer {
  constructor(servers) {
    this.servers = servers;
    this.current = 0;
  }

  getNextServer() {
    const server = this.servers[this.current];
    this.current = (this.current + 1) % this.servers.length;
    return server;
  }
}
\`\`\`

## Conclusion

Choose the right load balancing strategy based on your system's requirements. Consider factors like traffic patterns, server capacity, and failover needs.`,
      categoryId: createdCategories.find(c => c.slug === 'system-design')?.id,
      published: true,
      readingTime: 12,
      views: 95,
      metaTitle: 'Load Balancing Strategies - System Design Guide',
      metaDescription: 'Learn load balancing strategies for scalable systems. Round robin, least connections, and more.',
      metaKeywords: 'load balancing, system design, scalability, architecture',
    },
  ];

  for (const postData of samplePosts) {
    const { categoryId, ...postFields } = postData;
    
    // Use upsert to avoid duplicate slug errors
    const post = await prisma.post.upsert({
      where: { slug: postFields.slug },
      update: {
        // Update existing post with new data
        ...postFields,
        authorId: user.id,
        publishedAt: postFields.published ? new Date() : null,
        tags: {
          set: createdTags.slice(0, 3).map(tag => ({ id: tag.id })),
        },
      },
      create: {
        ...postFields,
        authorId: user.id,
        publishedAt: postFields.published ? new Date() : null,
        tags: {
          connect: createdTags.slice(0, 3).map(tag => ({ id: tag.id })),
        },
      },
    });
    console.log(`✅ Post ${post.id === post.id ? 'created' : 'updated'}: ${post.title}`);
  }

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📝 Summary:');
  console.log(`   - 1 Admin user (admin@example.com / admin123)`);
  console.log(`   - 1 Test user (user@example.com / user123)`);
  console.log(`   - ${createdCategories.length} Categories`);
  console.log(`   - ${createdTags.length} Tags`);
  console.log(`   - ${samplePosts.length} Sample posts`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

