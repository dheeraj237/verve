# Backend Performance Testing - Answers

## Question 1: Gatling Performance Test Setup

📋 **[Back to Question](../sse-topics.md#backend-performance-testing)** | **Topic:** Performance testing with Gatling

```scala
class ApiLoadTest extends Simulation {
  
  val httpProtocol = http
    .baseUrl("https://api.example.com")
    .header("Authorization", "Bearer ${token}")
  
  val scn = scenario("API Load Test")
    .exec(
      http("Create Order")
        .post("/orders")
        .body(StringBody("""{"items": [...]}"""))
        .check(status.is(201))
    )
  
  setUp(
    scn.inject(
      rampUsers(1000) during(5.minutes) // Gradual ramp-up
    )
  ).protocols(httpProtocol)
}
```

**Key Metrics:**
- **Response time percentiles:** P50, P95, P99 (not averages!)
- **Throughput:** Requests/second
- **Error rate:** Percentage of failed requests
- **Concurrent users:** Active users at peak

---

## Question 2: Understanding Percentiles

📋 **[Back to Question](../sse-topics.md#backend-performance-testing)** | **Topic:** Performance testing analysis

**Scenario:** P95 = 3s, Average = 200ms

**Analysis:**
- 95% of requests complete under 3s
- 5% of requests take > 3s (outliers)
- Average hides the outliers

**Possible Causes:**
- GC pauses
- Database slow queries
- External API timeouts
- Resource exhaustion

**Action:** Investigate the slowest 5% of requests for bottlenecks.

---

