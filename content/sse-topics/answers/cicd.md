# CI/CD - Answers

## Question 1: CI/CD for Microservices

📋 **[Back to Question](../sse-topics.md#cicd)** | **Topic:** CI/CD and DevOps

```mermaid
graph LR
    A[Git Push] --> B[Build Pipeline]
    B --> C[Unit Tests]
    C --> D[Docker Build]
    D --> E[Push to Registry]
    E --> F[Deploy to Staging]
    F --> G[Integration Tests]
    G --> H[Deploy to Production]
    H --> I[Canary/Blue-Green]
```

**Best Practices:**
- Monorepo or polyrepo with shared pipeline templates
- Service-specific vs shared integration tests
- Automated rollback on failure
- Feature flags for gradual rollout

---

