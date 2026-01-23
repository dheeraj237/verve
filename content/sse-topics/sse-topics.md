## Table of Contents

- [REST APIs](#rest-apis)
- [API Documentation & Management](#api-documentation--management)
- [API Integration](#api-integration)
- [Java](#java)
- [Spring Boot](#spring-boot)
- [MongoDB](#mongodb)
- [Backend Performance Testing](#backend-performance-testing)
- [System Design](#system-design)
- [Software Architecture](#software-architecture)
- [Database Knowledge](#database-knowledge)
- [PostgreSQL](#postgresql)
- [Data Structure & Algorithms](#data-structure--algorithms)
- [Low-level Design](#low-level-design)
- [Monitoring & Observability](#monitoring--observability)
- [CI/CD](#cicd)
- [Docker](#docker)
- [Kubernetes](#kubernetes)
- [ELK Stack](#elk-stack)
- [HTTP](#http)
- [Unit Testing](#unit-testing)
- [User Authentication & Authorization](#user-authentication--authorization)
- [Development Concepts](#development-concepts)
- [Code Quality](#code-quality)
- [Code Review](#code-review)
- [Version Control](#version-control)
- [Problem Solving](#problem-solving)
- [Soft Skills](#soft-skills)
- [AI-Assisted Software Development](#ai-assisted-software-development)
- [IOT](#iot)
- [SQL](#sql)
- [API Gateway](#api-gateway)
- [Cloud Services](#cloud-services)

---

## REST APIs

### Question 1 (Hard)
**Question:** Walk me through how you'd design the REST API for a multi-tenant SaaS application. What considerations would you keep in mind for tenant isolation?

**Short Description:** REST API design with multi-tenancy

**What This Evaluates:** Understanding of REST principles and practical design decisions for complex scenarios

**How to Evaluate:**
Look for discussion of URL strategies (subdomain vs path-based), authentication tokens with tenant context, data isolation strategies, and rate limiting per tenant. Strong candidates will mention security implications and scalability concerns.

📘 **[View Detailed Answer](./answers/rest-apis.md#question-1-multi-tenant-saas-rest-api-design)**

---

### Question 2 (Hard)
**Question:** Let's say your REST API suddenly starts returning 500 errors for 20% of requests. Walk me through your debugging process.

**Short Description:** Troubleshooting and REST fundamentals

**What This Evaluates:** Problem-solving approach and understanding of HTTP status codes

**How to Evaluate:**
Strong candidates will methodically check logs, monitoring tools, database connections, and external dependencies. They should mention checking for specific error patterns, request payloads, and recent deployments. Look for systematic thinking.

📘 **[View Detailed Answer](./answers/rest-apis.md#question-2-rest-api-debugging-500-errors)**

---

### Question 3 (Hard)
**Question:** How would you implement rate limiting in a RESTful service? What data would you track and where would you store it?

**Short Description:** RESTful service implementation with constraints

**What This Evaluates:** Practical implementation knowledge of API constraints

**How to Evaluate:**
Look for mentions of token bucket or leaky bucket algorithms, storage options (Redis, in-memory cache), distributed rate limiting challenges, and appropriate HTTP headers (X-RateLimit-*). Strong answers include handling edge cases.

📘 **[View Detailed Answer](./answers/rest-apis.md#question-3-rate-limiting-implementation)**

---

## API Documentation & Management

### Question 1 (Hard)
**Question:** I see you've worked with APIs before. Tell me about a time when you had to version an API that was already in production. What strategy did you use and why?

**Short Description:** API versioning and backward compatibility

**What This Evaluates:** Real-world experience with API management and versioning strategies

**How to Evaluate:**
Evaluate whether they mention URI versioning, header-based versioning, or content negotiation. Good answers include deprecation strategies, maintaining old versions, and communication with API consumers. Look for understanding of breaking vs non-breaking changes.

� **[View Detailed Answer](./answers/api-documentation-management.md#question-1-api-versioning-in-production)**

---

## API Integration

### Question 1 (Hard)
**Question:** Tell me about the most complex API integration you've done. What made it challenging?

**Short Description:** Real-world API integration experience

**What This Evaluates:** Practical experience and problem-solving in API integration

**How to Evaluate:**
Evaluate the complexity they describe, whether they mention issues like inconsistent documentation, rate limits, webhook handling, or data transformation. Look for how they approached testing and error handling.

� **[View Detailed Answer](./answers/api-integration.md#question-1-complex-api-integration-challenges)**

---

## Java

### Question 1 (Hard)
**Question:** If you had to choose between OAuth 2.0 and JWT for authentication in a microservices architecture, which would you pick and why?

**Short Description:** Authentication mechanisms and architectural thinking

**What This Evaluates:** Understanding of authentication patterns and their trade-offs

**How to Evaluate:**
Good candidates will explain that OAuth 2.0 is a framework while JWT is a token format, and they can be used together. Look for discussion of stateless vs stateful authentication, token revocation challenges, and microservice-to-service authentication.

� **[View Detailed Answer](./answers/java.md#question-1-oauth-20-vs-jwt-for-microservices)**

---

### Question 2 (Hard)
**Question:** You're reviewing code and see someone catching Exception in Java and just logging it. What's wrong with this approach and what would you suggest instead?

**Short Description:** Exception handling best practices

**What This Evaluates:** Understanding of proper exception handling patterns

**How to Evaluate:**
Strong candidates will mention hiding root causes, catching too broadly, not allowing appropriate exceptions to bubble up, and the importance of specific exception types. Look for mentions of checked vs unchecked exceptions and recovery strategies.

� **[View Detailed Answer](./answers/java.md#question-2-exception-handling-best-practices)**

---

### Question 3 (Hard)
**Question:** Explain how you'd implement the Strategy pattern in Java. When would you use it over a simple if-else chain?

**Short Description:** Design patterns application

**What This Evaluates:** Practical understanding of design patterns and their appropriate use

**How to Evaluate:**
Look for a clear explanation with code structure, understanding of when complexity is justified, and mention of Open/Closed principle. Good answers include real examples where they've used it or seen it used effectively.

� **[View Detailed Answer](./answers/java.md#question-3-strategy-pattern-implementation)**

---

### Question 4 (Hard)
**Question:** Walk me through what happens when you call 'new HashMap<>()' in Java. What's going on under the hood?

**Short Description:** Java fundamentals and internals

**What This Evaluates:** Deep understanding of Java collections and memory

**How to Evaluate:**
Strong answers cover initial capacity, load factor, hash collision handling (linked list/tree conversion in Java 8+), and resizing behavior. Look for understanding of hash functions and performance implications.

� **[View Detailed Answer](./answers/java.md#question-4-hashmap-internals)**

---

### Question 5 (Hard)
**Question:** I see multiple threads accessing a shared ArrayList in this codebase. What could go wrong and how would you fix it?

**Short Description:** Multi-threading and concurrency

**What This Evaluates:** Understanding of thread safety and concurrent programming

**How to Evaluate:**
Candidates should identify race conditions, potential data corruption, and ConcurrentModificationException. Solutions should include CopyOnWriteArrayList, Collections.synchronizedList(), or proper synchronization. Strong candidates explain trade-offs.

� **[View Detailed Answer](./answers/java.md#question-5-thread-safety-with-collections)**

---

### Question 6 (Hard)
**Question:** What new features in Java 17 would you actually use in production code? Why those specifically?

**Short Description:** Modern Java features awareness

**What This Evaluates:** Knowledge of recent Java improvements and practical judgment

**How to Evaluate:**
Look for mentions of sealed classes, pattern matching, records, or text blocks. Strong candidates explain benefits in real scenarios rather than just listing features. Bonus for understanding of LTS versions and migration considerations.

� **[View Detailed Answer](./answers/java.md#question-6-java-17-features-in-production)**

---

### Question 7 (Hard)
**Question:** Tell me about a performance issue you've debugged in a Java application. What tools did you use?

**Short Description:** JVM performance and debugging skills

**What This Evaluates:** Practical troubleshooting experience with Java

**How to Evaluate:**
Evaluate whether they mention profilers (JProfiler, YourKit, VisualVM), heap dumps, thread dumps, GC logs, or APM tools. Look for systematic debugging approach and understanding of JVM metrics.

� **[View Detailed Answer](./answers/java.md#question-7-java-performance-debugging)**

---

### Question 8 (Hard)
**Question:** How would you design a custom annotation in Java and use it with reflection? Give me a practical use case.

**Short Description:** Advanced Java programming

**What This Evaluates:** Understanding of Java annotations and reflection API

**How to Evaluate:**
Strong answers include retention policies, target elements, and actual use cases like validation, AOP, or custom ORM mapping. Look for awareness of performance implications of reflection.

� **[View Detailed Answer](./answers/java.md#question-8-custom-annotations-with-reflection)**

---

### Question 9 (Hard)
**Question:** You're seeing OutOfMemoryError in production. Walk me through how you'd diagnose whether it's a memory leak or just insufficient heap.

**Short Description:** JVM troubleshooting and performance

**What This Evaluates:** Practical JVM debugging and memory management skills

**How to Evaluate:**
Look for mention of heap dumps, memory analyzers (MAT, JProfiler), GC logs analysis, and distinguishing patterns. Strong candidates discuss heap vs native memory and different OOM error types.

� **[View Detailed Answer](./answers/java.md#question-9-outofmemoryerror-diagnosis)**

---

### Question 10 (Hard)
**Question:** Explain lazy loading in JPA. When would it cause problems and how would you fix it?

**Short Description:** JPA and ORM understanding

**What This Evaluates:** Deep understanding of ORM concepts and common pitfalls

**How to Evaluate:**
Good answers cover N+1 query problem, LazyInitializationException, and solutions like JOIN FETCH, Entity Graphs, or appropriate fetch types. Look for understanding of transaction boundaries.

� **[View Detailed Answer](./answers/java.md#question-10-jpa-lazy-loading)**

---

### Question 11 (Hard)
**Question:** How would you implement optimistic locking in a REST API using JPA? What if two users try to update the same record simultaneously?

**Short Description:** Concurrency and JPA

**What This Evaluates:** Understanding of database concurrency patterns

**How to Evaluate:**
Strong candidates mention @Version annotation, handling OptimisticLockException, returning appropriate HTTP status (409 Conflict), and client retry strategies. Look for understanding of when to use optimistic vs pessimistic locking.

� **[View Detailed Answer](./answers/java.md#question-11-optimistic-locking-in-jpa)**

---

## Spring Boot

### Question 1 (Hard)
**Question:** In Spring Boot, what's the difference between @Component, @Service, and @Repository? Does it actually matter which one you use?

**Short Description:** Spring Boot fundamentals and conventions

**What This Evaluates:** Understanding of Spring stereotypes and their purposes

**How to Evaluate:**
Good answers explain semantic meaning, exception translation in @Repository, and architectural clarity. Strong candidates mention that technically they're similar but serve documentation and future tooling purposes.

� **[View Detailed Answer](./answers/spring-boot.md#question-1-component-vs-service-vs-repository)**

---

### Question 2 (Hard)
**Question:** You have a Spring Boot application with a memory leak. How would you identify which bean is causing it?

**Short Description:** Spring Boot troubleshooting

**What This Evaluates:** Practical debugging skills in Spring environment

**How to Evaluate:**
Look for systematic approach: heap dump analysis, checking for static references, improper bean scopes, event listeners not being cleaned up, and thread locals. Strong candidates mention Spring-specific issues like prototype beans in singletons.

� **[View Detailed Answer](./answers/spring-boot.md#question-2-memory-leak-diagnosis-in-spring-boot)**

---

### Question 3 (Hard)
**Question:** Explain how Spring's dependency injection works. What happens during application startup?

**Short Description:** Core Spring framework understanding

**What This Evaluates:** Deep knowledge of Spring IoC container

**How to Evaluate:**
Strong answers cover component scanning, bean definition creation, dependency resolution, circular dependency handling, and bean lifecycle callbacks. Look for understanding of BeanFactory vs ApplicationContext.

� **[View Detailed Answer](./answers/spring-boot.md#question-3-spring-dependency-injection-lifecycle)**

---

### Question 4 (Hard)
**Question:** When would you use @Transactional(propagation = REQUIRES_NEW) and what are the risks?

**Short Description:** Spring transactions and database operations

**What This Evaluates:** Understanding of transaction management and propagation

**How to Evaluate:**
Good candidates explain that it creates a new transaction even if one exists, mention deadlock risks, performance implications, and appropriate use cases like audit logging. Look for understanding of transaction isolation levels.

� **[View Detailed Answer](./answers/spring-boot.md#question-4-transactional-propagation)**

---

### Question 5 (Hard)
**Question:** How do you handle long-running operations in Spring Boot without blocking the main thread? Walk me through your approach.

**Short Description:** Asynchronous programming in Spring

**What This Evaluates:** Understanding of async patterns and Spring capabilities

**How to Evaluate:**
Look for mentions of @Async, CompletableFuture, reactive programming with WebFlux, or message queues. Strong answers include error handling in async methods and thread pool configuration.

� **[View Detailed Answer](./answers/spring-boot.md#question-5-handling-long-running-operations-async)**

---

### Question 6 (Hard)
**Question:** If you had to implement rate limiting in Spring Boot, how would you do it? Consider a distributed environment.

**Short Description:** Spring Boot implementation and distributed systems

**What This Evaluates:** Practical implementation skills and distributed systems thinking

**How to Evaluate:**
Strong candidates mention Spring AOP for cross-cutting concerns, Redis for distributed state, Bucket4j or Resilience4j libraries, and handling race conditions. Look for consideration of synchronization across instances.

� **[View Detailed Answer](./answers/spring-boot.md#question-6-rate-limiting-in-spring-boot-distributed)**

---

### Question 7 (Hard)
**Question:** Explain the difference between @MockBean and @Mock in Spring Boot tests. When would you use each?

**Short Description:** Unit testing in Spring context

**What This Evaluates:** Understanding of testing strategies and Spring test framework

**How to Evaluate:**
Good answers explain that @MockBean is Spring-specific and replaces beans in application context, while @Mock is pure Mockito. Look for understanding of when you need Spring context vs lightweight unit tests.

� **[View Detailed Answer](./answers/spring-boot.md#question-7-mockbean-vs-mock-in-testing)**

---

## MongoDB

### Question 1 (Medium)
**Question:** In MongoDB, how would you model a one-to-many relationship differently than in a relational database? Give me a concrete example.

**Short Description:** Document-oriented database design

**What This Evaluates:** Understanding of NoSQL modeling vs relational

**How to Evaluate:**
Look for discussion of embedding vs referencing, considering access patterns, document size limits (16MB), and denormalization. Strong candidates mention read/write patterns driving the decision.

� **[View Detailed Answer](./answers/mongodb.md#question-1-document-oriented-modeling)**

---

### Question 2 (Medium)
**Question:** You're seeing slow queries in MongoDB. Walk me through how you'd investigate and fix it.

**Short Description:** MongoDB performance and indexing

**What This Evaluates:** Practical troubleshooting and optimization skills

**How to Evaluate:**
Candidates should mention explain() output, checking indexes, looking at query patterns, and monitoring tools. Look for understanding of index types (compound, text, geospatial) and when to use them.

� **[View Detailed Answer](./answers/mongodb.md#question-2-query-performance-optimization)**

---

### Question 3 (Medium)
**Question:** How would you handle a scenario where MongoDB replication lag is affecting your application's read consistency?

**Short Description:** MongoDB replication understanding

**What This Evaluates:** Knowledge of distributed database challenges

**How to Evaluate:**
Strong answers include read preferences (primary, secondary, primaryPreferred), write concerns, and application-level solutions. Look for understanding of CAP theorem trade-offs.

� **[View Detailed Answer](./answers/mongodb.md#question-3-replication-lag-solutions)**

---

### Question 4 (Medium)
**Question:** Tell me about sharding in MongoDB. When would you actually need it and what are the gotchas?

**Short Description:** MongoDB scalability and partitioning

**What This Evaluates:** Understanding of horizontal scaling strategies

**How to Evaluate:**
Look for discussion of shard keys, chunk distribution, hotspots, and operational complexity. Good candidates explain it's needed for data size or throughput, not just theoretical scaling.

� **[View Detailed Answer](./answers/mongodb.md#question-4-mongodb-sharding-when-and-how)**

---

## Backend Performance Testing

### Question 1 (Medium)
**Question:** Walk me through how you'd set up a performance test using Gatling for a REST API. What metrics matter most?

**Short Description:** Performance testing with Gatling

**What This Evaluates:** Practical knowledge of performance testing tools

**How to Evaluate:**
Strong answers cover scenario design, ramp-up strategies, response time percentiles (not just averages), error rates, and throughput. Look for understanding of realistic load patterns.

� **[View Detailed Answer](./answers/backend-performance-testing.md#question-1-gatling-performance-test-setup)**

---

### Question 2 (Medium)
**Question:** You ran a load test and the 95th percentile response time is 3 seconds but the average is 200ms. What does this tell you?

**Short Description:** Performance testing analysis

**What This Evaluates:** Understanding of performance metrics and their meaning

**How to Evaluate:**
Good candidates identify that outliers exist, possibly indicating resource exhaustion, GC pauses, or external dependency issues. Look for understanding that percentiles matter more than averages for user experience.

� **[View Detailed Answer](./answers/backend-performance-testing.md#question-2-understanding-percentiles)**

---

## System Design

### Question 1 (Hard)
**Question:** How would you design a URL shortener service? Consider scalability and what happens when it goes viral.

**Short Description:** System design and scalability

**What This Evaluates:** High-level design thinking and scalability considerations

**How to Evaluate:**
Look for discussion of ID generation (base62 encoding), database choice, caching strategy, redirect handling (301 vs 302), and handling spike traffic. Strong candidates mention analytics and distributed systems challenges.

� **[View Detailed Answer](./answers/system-design.md#question-1-url-shortener-design)**

---

### Question 2 (Hard)
**Question:** If you had to design Netflix, what would be the key components and how would they interact?

**Short Description:** System design for complex systems

**What This Evaluates:** High-level architectural thinking and scalability

**How to Evaluate:**
Look for CDN usage, video encoding pipeline, recommendation engine, user profiles, viewing history, and scalability considerations. Strong candidates discuss data consistency, caching layers, and geographic distribution.

� **[View Detailed Answer](./answers/system-design.md#question-2-design-netflix)**

---

### Question 3 (Hard)
**Question:** How do you ensure data consistency when a payment succeeds but the order service fails to update?

**Short Description:** Distributed transactions and consistency

**What This Evaluates:** Understanding of failure modes and recovery

**How to Evaluate:**
Strong answers include idempotency, saga pattern, outbox pattern, or event sourcing. Look for understanding that distributed transactions are hard and eventual consistency is often the answer.

� **[View Detailed Answer](./answers/system-design.md#question-3-distributed-transactions---saga-pattern)**

---

### Question 4 (Hard)
**Question:** Design a rate limiter that works across multiple servers. How do you synchronize state?

**Short Description:** Distributed systems design

**What This Evaluates:** Practical distributed systems knowledge

**How to Evaluate:**
Look for Redis-based solutions, sliding window algorithms, and handling edge cases. Strong candidates discuss network partitions, clock synchronization, and approximate counting for scale.

� **[View Detailed Answer](./answers/system-design.md#question-4-distributed-rate-limiter-design)**

---

### Question 5 (Hard)
**Question:** What questions would you ask if I asked you to design Instagram?

**Short Description:** Requirements gathering and system design

**What This Evaluates:** Problem-solving approach and requirement clarification

**How to Evaluate:**
Evaluate whether they ask about scale (MAU, DAU), read/write ratio, features scope (stories, DMs, feed), latency requirements, and geographic distribution. Look for clarifying questions before jumping to solutions.

� **[View Detailed Answer](./answers/system-design.md#question-5-design-instagram---requirements-gathering)**

---

## Software Architecture

### Question 1 (Hard)
**Question:** Explain microservices to me like I haven't worked with them before. Then tell me when you'd choose a monolith instead.

**Short Description:** Microservices architecture understanding

**What This Evaluates:** Architectural judgment and practical experience

**How to Evaluate:**
Good answers explain independent deployment, bounded contexts, and challenges like distributed transactions and debugging. Strong candidates explain monoliths are better for small teams or early-stage startups. Look for nuanced understanding.

� **[View Detailed Answer](./answers/software-architecture.md#question-1-microservices-vs-monolith)**

---

### Question 2 (Hard)
**Question:** What's your approach to handling distributed transactions across microservices? Give me a real example.

**Short Description:** Distributed systems and data consistency

**What This Evaluates:** Understanding of eventual consistency patterns

**How to Evaluate:**
Look for mentions of Saga pattern, event sourcing, or CQRS. Strong candidates explain two-phase commit problems and prefer eventual consistency. Evaluate based on practical trade-offs discussed.

📄 **[View Detailed Answer](./sse-topics_answers.md#question-2-handling-distributed-transactions-across-microservices)**

---

### Question 3 (Hard)
**Question:** If you had to implement event-driven architecture, what would you use as the message broker and why?

**Short Description:** Event-driven architecture knowledge

**What This Evaluates:** Understanding of messaging systems and their trade-offs

**How to Evaluate:**
Candidates should compare Kafka, RabbitMQ, AWS SQS/SNS with pros/cons. Look for discussion of message ordering, exactly-once semantics, and operational complexity.

� **[View Detailed Answer](./answers/software-architecture.md#question-2-event-driven-architecture)**

---

## Database Knowledge

### Question 1 (Medium)
**Question:** Explain the CAP theorem with a real example from your experience. Which consistency model did you choose and why?

**Short Description:** Distributed systems fundamentals

**What This Evaluates:** Understanding of distributed system trade-offs

**How to Evaluate:**
Strong answers use concrete examples, explain you can't have all three in network partition, and discuss practical choices like eventual consistency. Look for real-world decision-making experience.

� **[View Detailed Answer](./answers/database-knowledge.md#question-1-cap-theorem)**

---

### Question 2 (Medium)
**Question:** How do you handle database schema migrations in a production environment with zero downtime?

**Short Description:** Database operations and deployment

**What This Evaluates:** Practical DevOps and database management skills

**How to Evaluate:**
Look for backward-compatible migrations, blue-green deployment mentions, and tools like Flyway or Liquibase. Strong candidates discuss expanding then contracting schema changes and rollback strategies.

� **[View Detailed Answer](./answers/database-knowledge.md#question-2-zero-downtime-schema-migration)**

---

### Question 3 (Medium)
**Question:** You have a table with 100 million rows and queries are slow. Walk me through your optimization process.

**Short Description:** Database performance tuning

**What This Evaluates:** Query optimization and troubleshooting skills

**How to Evaluate:**
Candidates should mention EXPLAIN plans, indexing strategy, query rewriting, partitioning, and possibly denormalization. Look for systematic approach and understanding of index trade-offs.

� **[View Detailed Answer](./answers/database-knowledge.md#question-3-query-optimization-for-large-tables)**

---

### Question 4 (Medium)
**Question:** Explain database normalization. Then tell me when you'd intentionally denormalize.

**Short Description:** Database design fundamentals

**What This Evaluates:** Understanding of database design principles

**How to Evaluate:**
Good answers explain normal forms with examples, then discuss read-heavy workloads, caching, and performance trade-offs. Look for practical judgment over theoretical knowledge.

� **[View Detailed Answer](./answers/database-knowledge.md#question-4-database-normalization-vs-denormalization)**

---

### Question 5 (Medium)
**Question:** What's the difference between sharding and partitioning? How would you implement each in PostgreSQL?

**Short Description:** Database scaling strategies

**What This Evaluates:** Understanding of horizontal scaling techniques

**How to Evaluate:**
Strong candidates distinguish that partitioning is logical division on one server while sharding distributes across servers. Look for PostgreSQL-specific knowledge like declarative partitioning and foreign data wrappers.

� **[View Detailed Answer](./answers/database-knowledge.md#question-5-sharding-vs-partitioning-in-postgresql)**

---

## PostgreSQL

### Question 1 (Medium)
**Question:** Explain JSONB in PostgreSQL. When would you use it instead of a traditional relational schema?

**Short Description:** PostgreSQL advanced features

**What This Evaluates:** Understanding of semi-structured data handling

**How to Evaluate:**
Good answers explain binary JSON storage, indexing capabilities (GIN), and use cases like flexible schemas, audit logs, or API response caching. Look for understanding of when flexibility trumps strict schema.

� **[View Detailed Answer](./answers/postgresql.md#question-1-jsonb-in-postgresql)**

---

### Question 2 (Medium)
**Question:** How would you optimize a PostgreSQL query that joins five tables and takes 10 seconds?

**Short Description:** PostgreSQL query optimization

**What This Evaluates:** Practical optimization skills

**How to Evaluate:**
Look for using EXPLAIN ANALYZE, checking indexes on join columns, considering query rewriting, materialized views, or breaking into smaller queries. Strong candidates mention statistics and vacuuming.

� **[View Detailed Answer](./answers/postgresql.md#question-2-postgresql-query-optimization-5-table-join)**

---

## Data Structure & Algorithms

### Question 1 (Medium)
**Question:** Tell me how you'd approach designing a data structure to implement an autocomplete feature for millions of products.

**Short Description:** Data structures and algorithms

**What This Evaluates:** Problem-solving and algorithmic thinking

**How to Evaluate:**
Strong answers mention Trie data structure, caching popular searches, and handling ranking/scoring. Look for consideration of memory vs speed trade-offs and approximate matching.

� **[View Detailed Answer](./answers/data-structures-algorithms.md#question-1-autocomplete-data-structure)**

---

### Question 2 (Medium)
**Question:** I need to process a million records. Walk me through different approaches and their trade-offs.

**Short Description:** Algorithmic thinking and scalability

**What This Evaluates:** Understanding of performance and architectural patterns

**How to Evaluate:**
Look for batch processing, streaming, parallel processing, database bulk operations, and queue-based approaches. Strong candidates discuss memory constraints and failure handling.

� **[View Detailed Answer](./answers/data-structures-algorithms.md#question-2-processing-million-records)**

---

## Low-level Design

### Question 1 (Medium)
**Question:** Design a parking lot system. Start with the classes and their relationships.

**Short Description:** Object-oriented design and low-level design

**What This Evaluates:** LLD skills and OO principles application

**How to Evaluate:**
Evaluate class identification (ParkingLot, Vehicle, Spot, Ticket), relationships, and key methods. Look for handling different vehicle types, spot allocation strategy, and payment processing. Strong answers apply SOLID principles.

� **[View Detailed Answer](./answers/low-level-design.md#question-1-parking-lot-system-design)**

---

### Question 2 (Medium)
**Question:** How would you design the database schema for a blogging platform with posts, comments, tags, and users?

**Short Description:** Database design and modeling

**What This Evaluates:** Practical database design skills

**How to Evaluate:**
Look for proper normalization, many-to-many relationship handling (post_tags junction table), foreign keys, and indexes on common query patterns. Strong candidates discuss soft deletes and audit fields.

� **[View Detailed Answer](./answers/low-level-design.md#question-2-blogging-platform-database-schema)**

---

## Monitoring & Observability

### Question 1 (Medium)
**Question:** How would you monitor a distributed system? What metrics and tools would you use?

**Short Description:** Monitoring and observability

**What This Evaluates:** Practical DevOps and observability knowledge

**How to Evaluate:**
Look for mentions of the three pillars (metrics, logs, traces), tools like Prometheus/Grafana, ELK stack, and distributed tracing (Jaeger, Zipkin). Strong answers include SLIs/SLOs and alerting strategies.

� **[View Detailed Answer](./answers/monitoring-observability.md#question-1-monitoring-distributed-systems)**

---

### Question 2 (Medium)
**Question:** You're getting paged at 2 AM because of high error rates. Walk me through your investigation process.

**Short Description:** Troubleshooting and incident response

**What This Evaluates:** Problem-solving under pressure and systematic debugging

**How to Evaluate:**
Evaluate systematic approach: checking dashboards, recent deployments, logs aggregation, database connections, external dependencies. Look for mention of rollback decisions and communication.

� **[View Detailed Answer](./answers/monitoring-observability.md#question-2-2-am-production-incident-response)**

---

## CI/CD

### Question 1 (Medium)
**Question:** How would you set up a CI/CD pipeline for a microservices application with 10+ services?

**Short Description:** CI/CD and DevOps

**What This Evaluates:** Practical DevOps knowledge and automation

**How to Evaluate:**
Strong answers include monorepo vs polyrepo trade-offs, shared pipeline templates, automated testing stages, gradual rollout strategies, and rollback mechanisms. Look for mentions of tools like Jenkins, GitLab CI, or GitHub Actions.

� **[View Detailed Answer](./answers/cicd.md#question-1-cicd-for-microservices)**

---

## Docker

### Question 1 (Medium)
**Question:** Explain Docker layers. Why should we care about the order of commands in a Dockerfile?

**Short Description:** Docker and containerization

**What This Evaluates:** Understanding of container internals

**How to Evaluate:**
Good answers explain layer caching, image size optimization, and putting frequently changing commands last. Look for practical examples like copying package.json before source code.

� **[View Detailed Answer](./answers/docker.md#question-1-docker-layers-and-optimization)**

---

### Question 2 (Medium)
**Question:** You have a Docker container that keeps crashing. How do you debug it?

**Short Description:** Container troubleshooting

**What This Evaluates:** Practical debugging skills

**How to Evaluate:**
Look for docker logs, docker exec, checking resource limits, health checks, and reviewing application logs. Strong candidates mention docker inspect and understanding exit codes.

� **[View Detailed Answer](./answers/docker.md#question-2-debugging-crashing-docker-containers)**

---

## Kubernetes

### Question 1 (Medium)
**Question:** How would you handle secrets in a Kubernetes deployment? What are the security implications?

**Short Description:** Kubernetes and security

**What This Evaluates:** Security awareness and K8s knowledge

**How to Evaluate:**
Look for mentions of Kubernetes Secrets, external secret managers (Vault, AWS Secrets Manager), RBAC, and not committing secrets to git. Strong candidates discuss encryption at rest and pod security policies.

� **[View Detailed Answer](./answers/kubernetes.md#question-1-kubernetes-secrets-management)**

---

### Question 2 (Medium)
**Question:** Walk me through what happens when you type 'kubectl apply -f deployment.yaml'

**Short Description:** Kubernetes fundamentals

**What This Evaluates:** Deep understanding of K8s architecture

**How to Evaluate:**
Strong answers cover API server communication, etcd storage, scheduler assigning pods, kubelet pulling images, and container runtime. Look for understanding of desired state reconciliation.

� **[View Detailed Answer](./answers/kubernetes.md#question-2-kubectl-apply-internals)**

---

### Question 3 (Medium)
**Question:** How would you implement blue-green deployment in a Kubernetes cluster?

**Short Description:** Deployment strategies and K8s

**What This Evaluates:** Advanced K8s knowledge and deployment patterns

**How to Evaluate:**
Good answers include using multiple Deployments with Service selector switching, Ingress routing changes, or tools like Argo Rollouts. Look for understanding of traffic shifting and rollback strategies.

� **[View Detailed Answer](./answers/kubernetes.md#question-3-blue-green-deployment-in-kubernetes)**

---

### Question 4 (Medium)
**Question:** Explain the difference between a StatefulSet and a Deployment in Kubernetes. When would you use each?

📄 **[View Detailed Answer](./sse-topics_answers.md#question-4-statefulset-vs-deployment)**

**Short Description:** Kubernetes workload types

**What This Evaluates:** Understanding of K8s abstractions and their purposes

**How to Evaluate:**
Strong candidates explain stable network identities, persistent storage, and ordered deployment/scaling of StatefulSets. Look for examples like databases or message brokers vs stateless web apps.

---

## ELK Stack

### Question 1 (Medium)
**Question:** How would you use Elasticsearch for application logs? Walk me through the setup.

📄 **[View Detailed Answer](./sse-topics_answers.md#question-1-elasticsearch-for-application-logs)**

**Short Description:** ELK stack and logging

**What This Evaluates:** Practical logging infrastructure knowledge

**How to Evaluate:**
Look for log shipping (Filebeat, Fluentd), index design, retention policies, and querying patterns. Strong candidates discuss mapping, analyzers, and performance considerations.

---

## HTTP

### Question 1 (Medium)
**Question:** Tell me about CORS. Why does it exist and how would you handle it in a production API?

📄 **[View Detailed Answer](./sse-topics_answers.md#question-1-cors-cross-origin-resource-sharing)**

**Short Description:** HTTP and web security

**What This Evaluates:** Understanding of web security mechanisms

**How to Evaluate:**
Good answers explain same-origin policy, preflight requests, and proper CORS header configuration. Look for security awareness about allowing only necessary origins and methods.

---

### Question 2 (Medium)
**Question:** What happens when you type a URL in a browser and hit enter? Be as detailed as possible.

� **[View Detailed Answer](./answers/http.md#question-2-what-happens-when-you-type-a-url)**

**Short Description:** Internet fundamentals

**What This Evaluates:** Comprehensive understanding of web technologies

**How to Evaluate:**
Evaluate depth covering DNS resolution, TCP handshake, TLS negotiation, HTTP request/response, rendering, and resource loading. Strong candidates explain critical rendering path.

---

## Unit Testing

### Question 1 (Medium)
**Question:** You're writing unit tests for a service that calls an external API. How do you test it effectively?

� **[View Detailed Answer](./answers/unit-testing.md#question-1-testing-service-with-external-api)**

**Short Description:** Unit testing best practices

**What This Evaluates:** Testing skills and dependency management

**How to Evaluate:**
Good answers include mocking external dependencies, testing error cases, using tools like WireMock or MockServer, and separating integration tests. Look for understanding of test isolation.

---

### Question 2 (Medium)
**Question:** Explain the difference between mocking and stubbing. When would you use each?

� **[View Detailed Answer](./answers/unit-testing.md#question-2-mocking-vs-stubbing)**

**Short Description:** Testing fundamentals

**What This Evaluates:** Understanding of testing patterns

**How to Evaluate:**
Strong candidates explain mocks verify interactions while stubs provide predetermined responses. Look for understanding of behavior verification vs state verification and appropriate use cases.

---

## User Authentication & Authorization

### Question 1 (Hard)
**Question:** How would you implement authentication in a single-page application? Consider security.

� **[View Detailed Answer](./answers/user-authentication-authorization.md#question-1-spa-authentication-implementation)**

**Short Description:** Authentication and security

**What This Evaluates:** Security awareness and practical auth implementation

**How to Evaluate:**
Look for token-based auth (JWT), storage considerations (httpOnly cookies vs localStorage), CSRF protection, XSS prevention, and refresh token rotation. Strong answers include OAuth 2.0 flow.

---

## Development Concepts

### Question 1 (Hard)
**Question:** How would you handle a situation where your application needs to process messages from a queue but occasionally fails?

� **[View Detailed Answer](./answers/development-concepts.md#question-1-message-queue-error-handling)**

**Short Description:** Asynchronous programming and reliability

**What This Evaluates:** Understanding of messaging patterns and error handling

**How to Evaluate:**
Look for retry strategies, exponential backoff, dead letter queues, and idempotency. Strong candidates discuss at-least-once vs exactly-once semantics and monitoring.

---

## Code Quality

### Question 1 (Hard)
**Question:** Tell me about a time you had to refactor a large piece of code. How did you ensure you didn't break anything?

**Short Description:** Code maintenance and quality

**What This Evaluates:** Practical refactoring experience and risk management

**How to Evaluate:**
Evaluate whether they mention comprehensive tests first, incremental changes, feature flags, and code reviews. Look for systematic approach and understanding of safe refactoring practices.

� **[View Detailed Answer](./answers/code-quality.md#question-1-refactoring-large-codebases-safely)**

---

### Question 2 (Hard)
**Question:** How do you ensure code quality in your team? What practices do you follow?

**Short Description:** Code quality and team practices

**What This Evaluates:** Leadership and quality-focused thinking

**How to Evaluate:**
Good answers include code reviews, linting, static analysis, test coverage requirements, and pair programming. Strong candidates discuss cultural aspects and continuous improvement.

📄 **[View Detailed Answer](./sse-topics_answers.md#question-2-code-quality-practices)**


### Question 3 (Hard)
**Question:** What's your approach to code documentation? How much is too much?

**Short Description:** Code quality and maintainability

**What This Evaluates:** Documentation philosophy and practices

**How to Evaluate:**
Strong candidates explain self-documenting code, meaningful comments for 'why' not 'what', README files, and API documentation. Look for practical approach that values maintainability without over-documenting.

📄 **[View Detailed Answer](./sse-topics_answers.md#question-3-code-documentation-approach)**


## Code Review

### Question 1 (Hard)
**Question:** You see a colleague's pull request with 2000 lines of changes. What do you do?

� **[View Detailed Answer](./answers/code-review.md#question-1-large-pull-request-2000-lines)**

**Short Description:** Code review practices and team collaboration

**What This Evaluates:** Code review skills and communication

**How to Evaluate:**
Good candidates suggest breaking into smaller PRs, focusing on architecture first, and having a conversation. Look for balancing thoroughness with pragmatism and constructive feedback approach.

---

## Version Control

### Question 1 (Hard)
**Question:** What's your git branching strategy? How do you handle hotfixes in production?

� **[View Detailed Answer](./answers/version-control.md#question-1-git-branching-strategy--hotfixes)**

**Short Description:** Version control practices

**What This Evaluates:** Understanding of git workflows and deployment

**How to Evaluate:**
Strong answers include Git Flow, trunk-based development, or GitHub Flow with pros/cons. Look for hotfix branch creation from production tags and proper merging back. Evaluate practical experience.

---

## Problem Solving

### Question 1 (Hard)
**Question:** Walk me through how you'd debug a production issue where users are reporting intermittent timeouts.

� **[View Detailed Answer](./answers/problem-solving.md#question-1-production-debugging---intermittent-timeouts)**

**Short Description:** Debugging and problem-solving

**What This Evaluates:** Systematic troubleshooting and production support skills

**How to Evaluate:**
Look for checking logs, APM tools, database slow queries, network issues, external dependencies, and recent deployments. Strong candidates mention communication with stakeholders during investigation.

---

### Question 2 (Hard)
**Question:** Describe a situation where you had to make a technical compromise due to time constraints. Would you do it differently now?

**Short Description:** Pragmatism and decision-making

**What This Evaluates:** Balancing perfect vs practical and learning from experience

**How to Evaluate:**
Evaluate understanding of technical debt, documenting shortcuts, and planning to address them. Look for self-awareness and learning from outcomes. Strong candidates explain clear reasoning.

📄 **[View Detailed Answer](./sse-topics_answers.md#question-2-technical-compromise-decision-making)**


### Question 3 (Hard)
**Question:** How do you prioritize technical debt versus new features?

📄 **[View Detailed Answer](./sse-topics_answers.md#question-3-technical-debt-vs-new-features-prioritization)**

**Short Description:** Technical leadership and prioritization

**What This Evaluates:** Product thinking and long-term code health

**How to Evaluate:**
Good answers include risk assessment, impact on velocity, stakeholder communication, and incremental improvements. Look for balance between business needs and engineering excellence.

---

## Soft Skills

### Question 1 (Medium)
**Question:** Tell me about a difficult technical decision you made. How did you approach it and what was the outcome?

� **[View Detailed Answer](./answers/soft-skills.md#question-1-difficult-technical-decision)**

**Short Description:** Soft skills and decision-making

**What This Evaluates:** Communication skills and learning from experience

**How to Evaluate:**
Look for structured thinking, considering trade-offs, involving team members, and learning from the outcome. Evaluate self-awareness and how they handle uncertainty.

---

### Question 2 (Medium)
**Question:** Tell me about a time you disagreed with a technical decision. How did you handle it?

� **[View Detailed Answer](./answers/soft-skills.md#question-2-technical-disagreement-handling)**

**Short Description:** Soft skills and communication

**What This Evaluates:** Interpersonal skills and professional maturity

**How to Evaluate:**
Evaluate ability to present data-driven arguments, listen to others, reach consensus or escalate appropriately, and commit to team decisions. Look for respectful disagreement handling.

---

### Question 3 (Medium)
**Question:** Tell me how you stay current with technology. What have you learned recently?

� **[View Detailed Answer](./answers/soft-skills.md#question-3-staying-current-with-technology)**

**Short Description:** Learning and growth mindset

**What This Evaluates:** Continuous learning and professional development

**How to Evaluate:**
Evaluate whether they read blogs, contribute to open source, attend conferences, or do side projects. Look for genuine interest and ability to apply learning. Recent learning shows active engagement.

---

### Question 4 (Medium)
**Question:** How would you handle a situation where a junior developer on your team is struggling?

� **[View Detailed Answer](./answers/soft-skills.md#question-4-mentoring-struggling-junior-developer)**

**Short Description:** Mentorship and leadership

**What This Evaluates:** People skills and team support

**How to Evaluate:**
Look for patience, pairing sessions, breaking down problems, providing resources, and regular check-ins. Strong candidates balance support with growth opportunities and know when to escalate.

---

## AI-Assisted Software Development

### Question 1 (Medium)
**Question:** How would you use GitHub Copilot or ChatGPT in your daily work? What are the risks?

� **[View Detailed Answer](./answers/ai-assisted-development.md#question-1-using-github-copilotchatgpt---risks-and-benefits)**

**Short Description:** AI-assisted development awareness

**What This Evaluates:** Understanding of modern development tools and their limitations

**How to Evaluate:**
Look for balanced view: useful for boilerplate, explanations, and quick prototypes, but needs human review. Strong candidates mention code licensing, security, and over-reliance concerns.

---

## IOT

### Question 1 (Medium)
**Question:** If you were designing an IoT system for thousands of devices sending telemetry data, what would you consider?

� **[View Detailed Answer](./answers/iot.md#question-1-iot-system-for-thousands-of-devices)**

**Short Description:** IoT and distributed systems

**What This Evaluates:** Understanding of IoT patterns and scalability

**How to Evaluate:**
Strong answers include MQTT for lightweight messaging, time-series databases, data aggregation, handling offline devices, and security. Look for consideration of bandwidth and battery constraints.

---

## SQL

### Question 1 (Medium)
**Question:** How would you optimize SQL queries that are doing full table scans?

� **[View Detailed Answer](./answers/sql.md#question-1-optimizing-queries-with-full-table-scans)**

**Short Description:** SQL optimization

**What This Evaluates:** Practical database performance skills

**How to Evaluate:**
Look for adding appropriate indexes, rewriting queries to use WHERE clauses, using LIMIT, partitioning, or query hints. Strong candidates check execution plans first and consider index trade-offs.

---

## API Gateway

### Question 1 (Medium)
**Question:** Explain how API Gateway fits in a microservices architecture. What problems does it solve?

� **[View Detailed Answer](./answers/api-gateway.md#question-1-api-gateway-in-microservices)**

**Short Description:** API Gateway and microservices

**What This Evaluates:** Understanding of API management patterns

**How to Evaluate:**
Good answers include single entry point, authentication, rate limiting, request routing, and protocol translation. Look for understanding of when it adds value vs complexity.

---

## Cloud Services

### Question 1 (Medium)
**Question:** What's your experience with serverless? When would you recommend it and when would you avoid it?

� **[View Detailed Answer](./answers/cloud-services.md#question-1-serverless---when-to-use-and-avoid)**

**Short Description:** Serverless and cloud architecture

**What This Evaluates:** Cloud architecture judgment

**How to Evaluate:**
Look for understanding of cold starts, stateless execution, cost model, and use cases like event-driven workloads or irregular traffic. Strong candidates discuss vendor lock-in and debugging challenges.

---

