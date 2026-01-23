## [1] Observability, Metrics, and Control

### Distributed Metrics Logging and Aggregation System (like Datadog, Prometheus)

**📺 Learning Resources:**
- [System Design: Metrics Monitoring and Alerting System](https://www.youtube.com/watch?v=YyOXt2MEkv4) - Gaurav Sen
- [Designing a Metrics System](https://www.youtube.com/watch?v=lB7YMvPX-YY) - Exponent
- [Time Series Database Concepts](https://www.youtube.com/watch?v=2SUBRE6wGiA) - Hussein Nasser
- [Prometheus Architecture Deep Dive](https://www.youtube.com/watch?v=h4Sl21AKiDg) - CNCF

**Refined Question:** Design a system that can collect, aggregate, and query metrics from millions of servers processing billions of events per day. Support real-time alerting and historical analysis.

**📖 [View Detailed Answer →](./answers/01-distributed-metrics-logging.md)**

**What Interviewer Evaluates:**
- Understanding of time-series databases and data modeling
- Handling write-heavy workloads at scale
- Data retention and downsampling strategies
- Query optimization for metric aggregations
- Trade-offs between accuracy and performance

**Key Concepts:**
- Time-series databases (InfluxDB, TimescaleDB, Prometheus)
- Data aggregation techniques (rollups, pre-aggregation)
- Push vs Pull models for metric collection
- Cardinality management and tag explosion
- Data retention policies and storage tiering
- Stream processing (Kafka, Flink)
- Sharding and partitioning strategies

---

### Collecting Performance Metrics from Thousands of Servers

**📺 Learning Resources:**
- [System Design: Distributed Monitoring and Metrics](https://www.youtube.com/watch?v=lB7YMvPX-YY) - System Design Interview
- [Building Observability for 99% Availability](https://www.youtube.com/watch?v=zqjF6qMrWVE) - InfoQ
- [APM Deep Dive](https://www.youtube.com/watch?v=gJzTmKYt8Ig) - Tech Primers
- [TimescaleDB for Monitoring](https://www.youtube.com/watch?v=Nq37r-F7dL8) - Timescale

**Refined Question:** Design an APM (Application Performance Monitoring) system that collects CPU, memory, disk, and network metrics from 100K+ servers with sub-minute latency and 5-year retention.

**📖 [View Detailed Answer →](./answers/02-performance-metrics-collection.md)**

**What Interviewer Evaluates:**
- Scalable data ingestion pipeline design
- Efficient storage and compression techniques
- System resource management on monitored hosts
- Real-time vs batch processing trade-offs
- Cost optimization for long-term storage

**Key Concepts:**
- Agent-based vs agentless monitoring
- Sampling strategies and adaptive sampling
- Data compression algorithms
- Hot/warm/cold storage tiers
- Metrics aggregation at edge/region/global levels
- Heartbeat mechanisms and failure detection
- Load balancing for metric collectors

---

### Monitoring Health for a Large Compute Cluster (like Kubernetes)

**📺 Learning Resources:**
- [Kubernetes Architecture Explained](https://www.youtube.com/watch?v=8C_SCDbUJTg) - TechWorld with Nana
- [Health Checks and Probes in Kubernetes](https://www.youtube.com/watch?v=aTlQBofihJQ) - That DevOps Guy
- [Building Reliable Distributed Systems](https://www.youtube.com/watch?v=G0NAxj4p7uw) - GOTO Conference
- [Kubernetes Failure Stories](https://www.youtube.com/watch?v=yR-HBQqYTr8) - KubeCon

**Refined Question:** Design a health monitoring system for a compute cluster with 10K+ nodes running containerized workloads. Detect failures, perform auto-remediation, and provide real-time cluster state visibility.

**📖 [View Detailed Answer →](./answers/03-cluster-health-monitoring.md)**

**What Interviewer Evaluates:**
- Distributed system failure modes understanding
- Health check design (liveness, readiness, startup probes)
- Consensus and leader election knowledge
- Auto-scaling and self-healing mechanisms
- State management in distributed systems

**Key Concepts:**
- Health check protocols (HTTP, TCP, gRPC)
- Gossip protocols for node discovery
- Leader election (Raft, Paxos)
- Service mesh concepts (Istio, Envoy)
- Circuit breaker patterns
- Quorum-based decision making
- Graceful degradation strategies

---

### Designing a Distributed Tracing System (like Jaeger, Zipkin)

**📺 Learning Resources:**
- [Distributed Tracing Explained](https://www.youtube.com/watch?v=r8UvWSX3KA8) - ByteByteGo
- [OpenTelemetry Deep Dive](https://www.youtube.com/watch?v=_OXYCzwFd1Y) - CNCF
- [Jaeger Architecture](https://www.youtube.com/watch?v=aMZoUIG-mgY) - Jaeger Project
- [Distributed Tracing at Scale](https://www.youtube.com/watch?v=taUvjdT0JvI) - Google Cloud

**Refined Question:** Design a distributed tracing system that can track requests across 1000+ microservices with minimal performance overhead (<5ms latency). Support trace sampling, correlation, and root cause analysis.

**📖 [View Detailed Answer →](./answers/04-distributed-tracing-system.md)**

**What Interviewer Evaluates:**
- Understanding of distributed transaction tracking
- Sampling algorithms and strategies
- Context propagation mechanisms
- Performance impact minimization
- Correlation and causality in distributed systems

**Key Concepts:**
- Trace context propagation (W3C Trace Context, B3)
- Span modeling and parent-child relationships
- Sampling strategies (head-based, tail-based, adaptive)
- Storage for high-cardinality trace data
- Trace aggregation and analysis
- Service dependency graphs
- OpenTelemetry standards

---

### Building a System to Sort Huge Datasets Across Machines (like MapReduce)

**📺 Learning Resources:**
- [MapReduce Paper Explained](https://www.youtube.com/watch?v=MAJ0aW5g17c) - MIT 6.824
- [Hadoop MapReduce Architecture](https://www.youtube.com/watch?v=SqvAaB3vK8U) - Edureka
- [External Sorting Algorithm](https://www.youtube.com/watch?v=ATK74YSzwxg) - Back To Back SWE
- [Distributed Sorting at Scale](https://www.youtube.com/watch?v=kCXrJn6R_sg) - Microsoft Research

**Refined Question:** Design a distributed sorting system that can sort 100TB of data across 1000 machines efficiently. Optimize for fault tolerance and minimize data movement.

**📖 [View Detailed Answer →](./answers/05-distributed-sorting-system.md)**

**What Interviewer Evaluates:**
- Understanding of distributed algorithms
- Data partitioning and shuffling strategies
- Fault tolerance in distributed computing
- Resource utilization optimization
- Network efficiency and data locality

**Key Concepts:**
- External sorting algorithms
- MapReduce paradigm
- Partitioning strategies (range, hash, composite)
- Data shuffling and serialization
- Speculative execution
- Combiner functions for optimization
- Fault tolerance through replication and checkpointing

---

### Control Plane for a Distributed Database (like Vitess, CockroachDB)

**📺 Learning Resources:**
- [Distributed Database Internals](https://www.youtube.com/watch?v=tpspO9K28PM) - CMU Database Group
- [CockroachDB Architecture](https://www.youtube.com/watch?v=6OFeuNy39Qg) - CockroachDB
- [Vitess Deep Dive](https://www.youtube.com/watch?v=q65TleTn2vg) - CNCF
- [Consensus Algorithms (Raft)](https://www.youtube.com/watch?v=IujMVjKvWP4) - Raft Visualization

**Refined Question:** Design a control plane for a distributed SQL database that manages cluster membership, schema changes, rebalancing, and failure recovery across global deployments.

**📖 [View Detailed Answer →](./answers/06-database-control-plane.md)**

**What Interviewer Evaluates:**
- Understanding of distributed database internals
- Metadata management strategies
- Schema evolution in distributed systems
- Automated operations and self-healing
- Multi-region coordination

**Key Concepts:**
- Consensus algorithms (Raft, Paxos)
- Metadata store design (etcd, ZooKeeper)
- Shard rebalancing and split/merge operations
- Rolling upgrades and backward compatibility
- Distributed transactions (2PC, Percolator)
- Lease management
- Topology awareness and rack/zone distribution

---

## [2] Streams, Queues and Live Features

### Kafka-Style Distributed Stream Processing Platform
**Refined Question:** Design a distributed streaming platform that can handle 10M messages/second with durability, ordering guarantees, and support for both real-time and batch consumption patterns.

**What Interviewer Evaluates:**
- Understanding of streaming vs messaging paradigms
- Durability and performance trade-offs
- Partitioning and ordering guarantees
- Consumer group management
- Exactly-once vs at-least-once semantics

**Key Concepts:**
- Log-based architecture and append-only logs
- Partitioning and partition assignment strategies
- Offset management and consumer groups
- Replication and ISR (In-Sync Replicas)
- Zero-copy optimization
- Backpressure handling
- Stream processing semantics (windowing, state management)

📺 **Learning Resources:**
- [Apache Kafka in 100 Seconds - Fireship](https://www.youtube.com/watch?v=uvb00oaa3k8)
- [Kafka Architecture Deep Dive - Confluent](https://www.youtube.com/watch?v=UNUz1-msbOM)
- [How Kafka's Storage Internals Work - Martin Kleppmann](https://www.youtube.com/watch?v=tpubTw0Bj1w)
- [System Design: Apache Kafka - ByteByteGo](https://www.youtube.com/watch?v=R873BlNVUB4)

[📖 View Detailed Answer →](./answers/07-kafka-stream-processing.md)

---

### Distributed Queue Service like RabbitMQ/SQS
**Refined Question:** Design a distributed message queue that supports FIFO ordering, at-least-once delivery, message priorities, and dead-letter queues. Handle 1M messages/second with sub-second latency.

**What Interviewer Evaluates:**
- Queue vs topic model understanding
- Message delivery guarantees
- Scalability patterns for queues
- Message visibility and timeout handling
- Dead-letter queue and poison message handling

**Key Concepts:**
- Message acknowledgment protocols
- Visibility timeout mechanism
- Message deduplication strategies
- Queue sharding and partitioning
- Priority queue implementations
- Prefetching and batching
- Message TTL and expiration
- DLQ (Dead Letter Queue) patterns

📺 **Learning Resources:**
- [Message Queues Explained - IBM Technology](https://www.youtube.com/watch?v=xErwDaOc-Gs)
- [RabbitMQ in 100 Seconds - Fireship](https://www.youtube.com/watch?v=NQ3fZtyXji0)
- [Amazon SQS Deep Dive - AWS re:Invent](https://www.youtube.com/watch?v=UesxWuZMZqI)
- [System Design: Message Queue - ByteByteGo](https://www.youtube.com/watch?v=oUJbuFMyBDk)

[📖 View Detailed Answer →](./answers/08-distributed-queue-service.md)

---

### Surge Pricing Engine for Ride Sharing (like Uber, Lyft)
**Refined Question:** Design a real-time pricing engine that dynamically adjusts prices based on supply-demand imbalance across different geographic zones. Update prices within 30 seconds of demand changes.

**What Interviewer Evaluates:**
- Real-time data processing architecture
- Geospatial data handling
- Pricing algorithm design
- Fairness and consistency in pricing
- Race conditions in concurrent updates

**Key Concepts:**
- Geohashing and spatial indexing (H3, S2)
- Real-time aggregation pipelines
- Event-driven architecture
- Time-series forecasting
- Cache invalidation strategies
- Price smoothing algorithms
- A/B testing for pricing strategies

📺 **Learning Resources:**
- [How Uber's Surge Pricing Works - Vox](https://www.youtube.com/watch?v=WFdqcQTLVB4)
- [Uber's H3 Hexagonal Hierarchical Geospatial Indexing System](https://www.youtube.com/watch?v=ay2uwtRO3QE)
- [Real-time Pricing at Uber - Uber Engineering](https://www.youtube.com/watch?v=Dz1lUBZfXTE)
- [System Design: Uber/Lyft - ByteByteGo](https://www.youtube.com/watch?v=lsKU38RKQSo)

[📖 View Detailed Answer →](./answers/09-surge-pricing-engine.md)

---

### ETA and Live Location Sharing Between Driver and Rider
**Refined Question:** Design a system for real-time location tracking and ETA calculation for 1M concurrent trips. Update locations every 4 seconds and recalculate ETA based on traffic conditions.

**What Interviewer Evaluates:**
- Real-time bidirectional communication design
- Geospatial query optimization
- Battery and bandwidth optimization
- ETA algorithm accuracy
- Handling network unreliability

**Key Concepts:**
- WebSocket/Server-Sent Events for real-time updates
- Geospatial databases (PostGIS, Redis Geo)
- Route optimization algorithms (Dijkstra, A*)
- Traffic data integration
- GPS data smoothing and interpolation
- Mobile battery optimization techniques
- Connection state management and reconnection

📺 **Learning Resources:**
- [How GPS Works - Lesics](https://www.youtube.com/watch?v=FU_pY2sTwTA)
- [Uber's Geospatial Architecture - Uber Engineering](https://www.youtube.com/watch?v=cSFWlF96Sds)
- [Real-time Location Tracking at Scale - InfoQ](https://www.youtube.com/watch?v=vgArZKHJFI4)
- [System Design: Uber Backend - Exponent](https://www.youtube.com/watch?v=umWABit-wbk)

[📖 View Detailed Answer →](./answers/10-eta-live-location-tracking.md)

---

### Live Comments System for a Social App (like Instagram, TikTok)
**Refined Question:** Design a live commenting system for video streams/posts that can handle 100K concurrent users per stream with sub-second comment delivery and spam filtering.

**What Interviewer Evaluates:**
- Real-time communication at scale
- Fan-out strategies for live updates
- Content moderation integration
- Handling celebrity/viral content scenarios
- Race conditions and ordering

**Key Concepts:**
- WebSocket connection management
- Pub/sub patterns
- Rate limiting per user
- Content filtering and moderation pipelines
- Comment ranking algorithms
- Connection pooling and horizontal scaling
- Graceful degradation under load

📺 **Learning Resources:**
- [WebSockets Explained - Fireship](https://www.youtube.com/watch?v=1BfCnjr_Vjg)
- [How Instagram Handles Live Comments - Meta Engineering](https://www.youtube.com/watch?v=hnpzNAPiC0E)
- [Real-time Communication at Scale - Hussein Nasser](https://www.youtube.com/watch?v=gzIcGhJC8hA)
- [System Design: Live Commenting - ByteByteGo](https://www.youtube.com/watch?v=FZ0cG47msEk)

[📖 View Detailed Answer →](./answers/11-live-comments-system.md)

---

### Showing Live Viewer Count on a Page (like YouTube, Twitch)
**Refined Question:** Design a system to display real-time viewer count on millions of concurrent pages/streams with eventual consistency. Support both anonymous and authenticated users.

**What Interviewer Evaluates:**
- Approximate counting at scale
- Trade-offs between accuracy and scalability
- Session tracking mechanisms
- Handling bot traffic
- Cache coherency

**Key Concepts:**
- HyperLogLog for approximate counting
- Sliding window counters
- Heartbeat mechanisms
- Probabilistic data structures
- CDN integration for global distribution
- Session tracking and user identification
- Bot detection heuristics
- Aggregation levels (per-second, per-minute rollups)

📺 **Learning Resources:**
- [HyperLogLog Explained - Computerphile](https://www.youtube.com/watch?v=Ll9A78O_jlM)
- [Counting at Scale - Redis University](https://www.youtube.com/watch?v=MtFbhH5JUhk)
- [System Design: YouTube View Counter - Exponent](https://www.youtube.com/watch?v=FTlFH0xEfp8)
- [Real-time Analytics at Scale - DataCouncil](https://www.youtube.com/watch?v=qCztqau4LkA)

[📖 View Detailed Answer →](./answers/12-live-viewer-count.md)

---

## [3] Storage, Sync and Large Files

### Key-Value Store at Scale (like DynamoDB, Redis)
**Refined Question:** Design a distributed key-value store that provides single-digit millisecond latency at any scale with configurable consistency levels. Support 10M QPS with automatic sharding and replication.

📺 [Watch: Designing a Distributed Key-Value Store](https://www.youtube.com/watch?v=rnZmdmlR-2M)

📄 [View Detailed Answer →](./answers/13-key-value-store.md)

**What Interviewer Evaluates:**
- CAP theorem understanding and trade-offs
- Consistent hashing and data distribution
- Replication strategies
- Conflict resolution mechanisms
- Read/write path optimization

**Key Concepts:**
- Consistent hashing with virtual nodes
- Vector clocks and conflict resolution
- Quorum-based reads/writes (R+W>N)
- Merkle trees for anti-entropy
- Gossip protocol for membership
- Read repair and hinted handoff
- LSM trees vs B-trees
- Bloom filters for read optimization

---

### Cloud File Storage like Dropbox or Google Drive
**Refined Question:** Design a cloud storage system supporting file sync across devices, versioning, sharing, and collaborative editing. Handle files up to 50GB with efficient incremental sync and conflict resolution.

📺 [Watch: Design Dropbox/Google Drive](https://www.youtube.com/watch?v=U0xTu6E2CT8)

📄 [View Detailed Answer →](./answers/14-cloud-file-storage.md)

**What Interviewer Evaluates:**
- Chunking and deduplication strategies
- Sync protocol design
- Conflict resolution in collaborative environments
- Metadata management
- Storage cost optimization

**Key Concepts:**
- Content-defined chunking (CDC)
- Delta sync algorithms
- Block-level deduplication
- Merkle DAG for version history
- Operational transforms or CRDT for collaborative editing
- Metadata store design
- S3/blob storage integration
- Client-side encryption
- Bandwidth optimization techniques

---

### Photo Sharing Platform like Google Photos or Flickr
**Refined Question:** Design a photo sharing platform that handles billions of photos with automatic organization, search by content, face detection, and shared albums. Support fast uploads and smart compression.

📺 [Watch: Design Instagram/Photo Sharing](https://www.youtube.com/watch?v=QmX2NPkJTKg)

📄 [View Detailed Answer →](./answers/15-photo-sharing-platform.md)

**What Interviewer Evaluates:**
- Large-scale object storage architecture
- Image processing pipeline design
- Search and indexing strategies
- ML pipeline integration
- Cost vs quality trade-offs

**Key Concepts:**
- Object storage (S3, GCS) architecture
- CDN integration for global delivery
- Image transcoding and adaptive compression
- ML inference pipelines (face detection, object recognition)
- Vector databases for similarity search
- Metadata extraction (EXIF) and indexing
- Album sharing and permission management
- Upload resumability and multipart uploads

---

### Distributed File Transfer like BitTorrent
**Refined Question:** Design a peer-to-peer file distribution system that can efficiently distribute large files (100GB+) to millions of peers with minimal server load. Ensure file integrity and handle peer churn.

📺 [Watch: BitTorrent System Design](https://www.youtube.com/watch?v=Qf1q3OlR8tg)

📄 [View Detailed Answer →](./answers/16-distributed-file-transfer.md)

**What Interviewer Evaluates:**
- P2P architecture understanding
- Incentive mechanisms design
- File integrity verification
- NAT traversal and connectivity
- Bandwidth optimization

**Key Concepts:**
- Tit-for-tat incentive mechanism
- DHT (Distributed Hash Table) for peer discovery
- Piece selection algorithms (rarest-first)
- Merkle trees for integrity verification
- NAT traversal (STUN, TURN)
- Tracker vs trackerless architecture
- Swarming and parallel downloads
- Endgame mode optimization

---

### Reliable File Downloader Library
**Refined Question:** Design a client library for downloading large files (10GB+) with resume capability, parallel chunk downloads, integrity verification, and retry logic with exponential backoff.

📺 [Watch: Designing Download Managers](https://www.youtube.com/watch?v=Fk12ELJ9Bww)

📄 [View Detailed Answer →](./answers/17-file-downloader-resume.md)

**What Interviewer Evaluates:**
- Error handling and retry strategies
- Concurrent download optimization
- State management for resumability
- Network efficiency
- API design principles

**Key Concepts:**
- HTTP range requests
- Chunk-based parallel downloads
- Checksum verification (MD5, SHA256)
- Exponential backoff with jitter
- Connection pooling
- Progress tracking and callbacks
- Atomic file replacement
- Bandwidth throttling
- Circuit breaker pattern

---

### Bulk Data Migration from On-Prem to Cloud
**Refined Question:** Design a system to migrate 100TB of data from on-premises databases to cloud storage with minimal downtime, data validation, and rollback capability. Support incremental migration and schema transformation.

📺 [Watch: Data Migration Strategies](https://www.youtube.com/watch?v=hiWCadHZ7FU)

📄 [View Detailed Answer →](./answers/18-bulk-data-migration.md)

**What Interviewer Evaluates:**
- Data migration strategies (big bang vs incremental)
- Zero-downtime migration techniques
- Data consistency validation
- Rollback and disaster recovery
- Performance optimization

**Key Concepts:**
- Change Data Capture (CDC)
- Dual-write patterns
- Data validation checksums
- Schema migration strategies
- Network optimization (compression, multipart)
- Snapshot + incremental approach
- Cutover strategies
- Data transfer appliances (AWS Snowball)
- Throttling to avoid source overload

---

## [4] Consumer Apps, Content and Feeds

### News Feed System like Facebook or Twitter
**Refined Question:** Design a news feed system that displays personalized posts from followed users with <500ms p99 latency. Support 2B users with hybrid fanout strategy and ML-based ranking.

📺 [Watch: Design News Feed System](https://www.youtube.com/watch?v=QmX2NPkJTKg)

📄 [View Detailed Answer →](./answers/19-news-feed-system.md)

**What Interviewer Evaluates:**
- Fanout strategies (push vs pull vs hybrid)
- Feed generation and ranking algorithms
- Caching strategies at scale
- Handling celebrities/high-follower accounts
- Real-time updates

**Key Concepts:**
- Fanout-on-write vs fanout-on-read
- Hybrid approach for scalability
- Redis sorted sets for feed caching
- ML-based feed ranking
- Post ingestion pipeline
- Timeline pagination
- Privacy and visibility controls
- Hot user problem

---

### Video Streaming Platform like YouTube or Netflix
**Refined Question:** Design a video streaming platform supporting upload, transcoding to multiple resolutions, adaptive streaming, recommendations, and global CDN delivery for 2B users.

📺 [Watch: Design YouTube](https://www.youtube.com/watch?v=jPKTo1iGQiE)

📄 [View Detailed Answer →](./answers/20-video-streaming-platform.md)

**What Interviewer Evaluates:**
- Video processing pipeline design
- Adaptive streaming protocols
- CDN architecture
- Storage optimization
- Recommendation systems

**Key Concepts:**
- Video transcoding (FFmpeg, AWS MediaConvert)
- HLS/DASH adaptive streaming
- Multi-bitrate encoding
- CDN edge caching
- Video chunking and packaging
- Thumbnail generation
- View count aggregation
- Recommendation algorithms
- DRM and content protection

---

### Autocomplete / Typeahead Search
**Refined Question:** Design an autocomplete system that provides search suggestions in <100ms with prefix matching, frequency-based ranking, and personalization for 10B queries/day.

📺 [Watch: Design Typeahead/Autocomplete](https://www.youtube.com/watch?v=us0qySiUsGU)

📄 [View Detailed Answer →](./answers/21-autocomplete-typeahead.md)

**What Interviewer Evaluates:**
- Data structure selection (Trie)
- Caching strategies
- Ranking algorithms
- Real-time updates
- Personalization

**Key Concepts:**
- Trie data structure
- Prefix matching algorithms
- Redis caching layer
- Query frequency tracking
- Periodic trie rebuilding
- Top-K algorithm
- User-specific suggestions
- Query aggregation
- Fuzzy matching

---

### Recommendation Engine System
**Refined Question:** Design a recommendation engine that provides personalized content suggestions (products, videos, articles) with <100ms latency using collaborative filtering, content-based, and hybrid approaches.

📺 [Watch: Design Recommendation System](https://www.youtube.com/watch?v=CtmBGH8MkX4)

📄 [View Detailed Answer →](./answers/22-recommendation-engine.md)

**What Interviewer Evaluates:**
- Recommendation algorithms understanding
- Feature engineering
- Model serving at low latency
- Cold start problem
- A/B testing infrastructure

**Key Concepts:**
- Collaborative filtering (user-user, item-item)
- Content-based filtering
- Matrix factorization
- Deep learning models
- Feature store design
- Model serving (TensorFlow Serving)
- Candidate generation and ranking
- Diversity and exploration
- Real-time vs batch predictions

---

### Social Media Analytics Dashboard
**Refined Question:** Design a real-time analytics dashboard that displays user engagement metrics (views, likes, shares) with aggregations over various time windows for millions of users with <2s load time.

📺 [Watch: Design Analytics Platform](https://www.youtube.com/watch?v=bUHFg8CZFws)

📄 [View Detailed Answer →](./answers/23-analytics-dashboard.md)

**What Interviewer Evaluates:**
- Lambda/Kappa architecture understanding
- Real-time vs batch processing trade-offs
- Data warehouse design
- Query optimization at scale
- Aggregation strategies

**Key Concepts:**
- Event collection and validation
- Stream processing (Flink, Spark Streaming)
- Time-series databases (InfluxDB)
- OLAP systems (ClickHouse)
- Pre-aggregation and materialized views
- Query result caching
- Data retention policies
- Real-time dashboards

---

### Task Scheduler / Cron Job System
**Refined Question:** Design a distributed task scheduler (like cron) that can execute millions of scheduled jobs reliably with exactly-once execution guarantees, retry logic, and failure handling.

📺 [Watch: Design Distributed Job Scheduler](https://www.youtube.com/watch?v=YIjrHc6fviA)

📄 [View Detailed Answer →](./answers/24-task-scheduler.md)

**What Interviewer Evaluates:**
- Distributed scheduling challenges
- Exactly-once execution guarantees
- Failure handling and retries
- Priority and dependency management
- High availability design

**Key Concepts:**
- Quartz scheduler or custom scheduler
- Distributed locks (ZooKeeper, Redis)
- Job queue (Redis, Kafka)
- Cron expression parsing
- Leader election
- Retry with exponential backoff
- Job dependencies (DAG)
- Execution history tracking
- Monitoring and alerting

---

### Calendar Application like Google Calendar
**Refined Question:** Design a calendar application supporting recurring events, time zones, reminders, shared calendars, and conflict detection. Handle concurrent updates from multiple devices with offline support.

**What Interviewer Evaluates:**
- CRUD operations at scale
- Concurrency control mechanisms
- Recurring event representation
- Time zone handling complexity
- Conflict resolution strategies

**Key Concepts:**
- Event storage and indexing
- Recurring event expansion (RRULE)
- Time zone normalization (UTC storage)
- Operational transforms or CRDT for sync
- Optimistic locking for conflict detection
- Push notifications and reminders
- Calendar sharing and permissions
- Offline-first architecture
- Free/busy calculation algorithms

📄 [View Detailed Answer →](./answers/25-calendar-application.md)

---

### User Analytics Dashboard and Data Pipeline
**Refined Question:** Design an analytics platform that processes billions of user events daily, provides real-time dashboards, and supports complex queries with sub-second latency. Enable custom segmentation and funnel analysis.

(See Analytics Dashboard question above)

**What Interviewer Evaluates:**
- Lambda/Kappa architecture understanding
- Real-time vs batch processing trade-offs
- Data warehouse design
- Query optimization at scale
- Privacy and data retention

**Key Concepts:**
- Event collection and validation
- Stream processing (Flink, Spark Streaming)
- Data warehouse (Redshift, BigQuery, Snowflake)
- Columnar storage and compression
- Pre-aggregation and materialized views
- OLAP cube design
- Data partitioning strategies
- Query result caching
- Sampling for large datasets
- Privacy-compliant data handling (GDPR, CCPA)

---

### Hotel Booking System with Availability, Reservation and Booking
**Refined Question:** Design a hotel booking platform handling inventory management, real-time availability, reservations with hold periods, overbooking prevention, and cancellation policies across 100K+ properties.

(Detailed answer coming soon)

**What Interviewer Evaluates:**
- Inventory management in distributed systems
- Handling concurrent bookings (race conditions)
- Transaction management
- Consistency requirements
- Search and filtering at scale

**Key Concepts:**
- Distributed transactions (2PC, Saga pattern)
- Optimistic/pessimistic locking
- Inventory snapshot and cache invalidation
- Idempotency for payment operations
- Search indexing (Elasticsearch)
- Date range queries optimization
- Hold/reservation timeout mechanisms
- Overbooking strategies
- Event sourcing for audit trails

---

### Weather Application Backend
**Refined Question:** Design a weather service that aggregates data from multiple sources, provides forecasts for millions of locations, sends severe weather alerts, and handles 10M API requests/day with 99.9% accuracy.

**What Interviewer Evaluates:**
- Third-party API integration patterns
- Data aggregation and normalization
- Caching strategies
- Location-based queries
- Push notification architecture

**Key Concepts:**
- Geospatial indexing (H3, S2, Geohash)
- API gateway and rate limiting
- Multi-source data reconciliation
- Cache hierarchies (location-based)
- Weather model interpolation
- WebSocket for real-time updates
- Alert prioritization and delivery
- Stale data handling
- Nearest neighbor search

📄 [View Detailed Answer →](./answers/28-weather-application.md)

---

### Marketplace Feature Inside a Social App (like Facebook Marketplace)
**Refined Question:** Design a marketplace within a social platform supporting item listings, search/filtering, messaging between buyers/sellers, ratings, and fraud detection. Handle 1M active listings.

**What Interviewer Evaluates:**
- Search and discovery mechanisms
- Trust and safety measures
- Multi-sided platform design
- Integration with existing social graph
- Fraud prevention

**Key Concepts:**
- Full-text search (Elasticsearch, Algolia)
- Faceted search and filters
- Recommendation systems
- Messaging infrastructure
- Reputation and rating systems
- Fraud detection ML models
- Image recognition for categorization
- Geofencing for local listings
- Escrow/payment integration
- Content moderation pipelines

📄 [View Detailed Answer →](./answers/29-marketplace-feature.md)

---

### Ads Management and Serving for a Social Feed
**Refined Question:** Design an ad serving system that selects relevant ads in <100ms, tracks impressions/clicks, prevents fraud, and optimizes for advertiser ROI. Handle 1B ad requests daily.

**What Interviewer Evaluates:**
- Real-time bidding architecture
- Ad targeting and personalization
- Click fraud prevention
- Performance optimization (<100ms)
- Revenue optimization

**Key Concepts:**
- Ad auction algorithms (second-price, VCG)
- User targeting and segmentation
- Real-time feature extraction
- ML model serving at low latency
- Impression/click tracking (write-heavy)
- Deduplication and fraud detection
- A/B testing infrastructure
- Pacing and budget management
- Cache-aside pattern for ad metadata
- Feedback loop for CTR prediction

📄 [View Detailed Answer →](./answers/30-ads-management-serving.md)

---

## [5] Money, Commerce and Pricing

### API Rate Limiter for Public or Paid APIs
**Refined Question:** Design a distributed rate limiting system that enforces multiple tiers (free, premium, enterprise) with different quotas per second/minute/day. Support 100K requests/second with <1ms latency overhead.

📺 [Watch: Rate Limiting System Design](https://www.youtube.com/watch?v=FU4WlwfS3G0)

**What Interviewer Evaluates:**
- Rate limiting algorithms knowledge
- Distributed counter synchronization
- Low-latency design
- Multi-tier quota management
- Handling clock skew

**Key Concepts:**
- Token bucket vs leaky bucket algorithms
- Sliding window counters
- Fixed window counters
- Distributed rate limiting (Redis Cluster)
- Sticky sessions vs distributed approach
- Rate limit headers (X-RateLimit-*)
- Graceful degradation
- Per-user vs per-IP limiting
- Quota reset strategies
- Circuit breaker integration

📄 [View Detailed Answer →](./answers/31-api-rate-limiter.md)

---

### Price Alert System for Products or Stocks
**Refined Question:** Design a price monitoring system that tracks 10M products/stocks and sends alerts to 100M users when price thresholds are met. Support complex conditions (% drop, absolute price, competitor pricing).

📺 [Watch: Notification System Design](https://www.youtube.com/watch?v=bBTPZ9NdSk8)

**What Interviewer Evaluates:**
- Event-driven architecture design
- Efficient matching algorithms
- Notification delivery at scale
- Data freshness vs cost trade-offs
- Deduplication strategies

**Key Concepts:**
- Change Data Capture from price sources
- Inverted index for alert matching
- Interval trees for range queries
- Batching for notification efficiency
- Notification delivery (push, email, SMS)
- User preference management
- Deduplication of notifications
- Backpressure handling
- Priority queues for high-value alerts
- Historical price tracking

📄 [View Detailed Answer →](./answers/32-price-alert-system.md)

---

### Credit Card Processing Engine
**Refined Question:** Design a payment processing system that handles credit card transactions with fraud detection, 3D Secure, PCI DSS compliance, and settlement. Process 10K TPS with 99.999% availability.

📺 [Watch: Payment System Design](https://www.youtube.com/watch?v=olfaBgJrUBI)

**What Interviewer Evaluates:**
- Payment flow understanding
- Security and compliance knowledge
- Idempotency in financial transactions
- Reconciliation mechanisms
- Distributed transaction handling

**Key Concepts:**
- PCI DSS compliance and tokenization
- Idempotency keys for retry safety
- Two-phase commit for distributed transactions
- Fraud detection (rule engine + ML)
- Authorization vs capture flow
- Settlement and reconciliation
- Chargeback handling
- Encryption at rest and in transit
- Audit logging and immutability
- Circuit breaker for payment gateways

📄 [View Detailed Answer →](./answers/33-credit-card-processing.md)

---

### Wire Transfer API Between Banks
**Refined Question:** Design an inter-bank wire transfer system supporting real-time settlements with ACID guarantees, fraud detection, regulatory compliance, and audit trails. Handle cross-currency transfers.

**What Interviewer Evaluates:**
- Distributed transaction consistency
- Financial regulations understanding
- Strong consistency requirements
- Audit and compliance
- Reconciliation strategies

**Key Concepts:**
- Saga pattern for distributed transactions
- Event sourcing for audit trails
- Exactly-once semantics
- Idempotency in money movement
- Double-entry bookkeeping
- AML/KYC compliance
- Currency conversion and FX rates
- Settlement timing and batching
- Ledger design patterns
- Reconciliation processes
- Disaster recovery and rollback

📄 [View Detailed Answer →](./answers/34-wire-transfer-api.md)

---

### Parts Compatibility System for an E-commerce Site (like Auto Parts)
**Refined Question:** Design a product compatibility matching system for automotive parts supporting year/make/model/trim lookup, cross-reference tables, and fitment data. Handle 100M compatibility records with sub-second search.

**What Interviewer Evaluates:**
- Graph database understanding
- Complex relationship modeling
- Search and filtering optimization
- Data modeling for hierarchical data
- Cache strategies for read-heavy workloads

**Key Concepts:**
- Graph databases (Neo4j) vs relational modeling
- Hierarchical data representation
- Materialized paths or nested sets
- Faceted search implementation
- Denormalization for read performance
- Compatibility matrix representation
- Universal part numbers (OEM/aftermarket)
- Search result ranking
- Cache warming strategies
- Bulk import and validation

📄 [View Detailed Answer →](./answers/35-parts-compatibility.md)

---

### Rider Matching for Ride Hailing or Food Delivery App
**Refined Question:** Design a rider/driver matching system that assigns orders to delivery partners in real-time optimizing for delivery time, driver utilization, and customer satisfaction. Handle 100K concurrent assignments.

**What Interviewer Evaluates:**
- Matching algorithm design
- Real-time optimization
- Constraint satisfaction
- Fairness in assignments
- Handling dynamic conditions

**Key Concepts:**
- Bipartite matching algorithms
- Hungarian algorithm / Stable marriage problem
- Geohashing for proximity search
- Real-time route optimization
- Multi-objective optimization (time, cost, fairness)
- Assignment reservation and timeout
- Batching vs real-time matching
- Predictive modeling for demand
- Re-assignment strategies
- Fair dispatch algorithms
- State machine for order lifecycle

📄 [View Detailed Answer →](./answers/36-rider-matching.md)

---

## [6] Platform, Auth and Reliability

### Login and Authentication System for Web and Mobile Apps
**Refined Question:** Design a multi-tenant authentication system supporting username/password, OAuth, SSO, MFA, and biometrics. Handle 1M logins/day with session management across web and mobile with 99.99% availability.

📺 [Watch: Authentication System Design](https://www.youtube.com/watch?v=uj_4vxm9u90)

**What Interviewer Evaluates:**
- Security best practices
- Session management strategies
- Token-based authentication
- Multi-factor authentication flow
- Password security and storage

**Key Concepts:**
- Password hashing (bcrypt, Argon2)
- JWT vs opaque tokens
- OAuth 2.0 / OpenID Connect flows
- Refresh token rotation
- Session storage (Redis, distributed cache)
- Rate limiting for brute force protection
- MFA implementation (TOTP, SMS, push)
- SSO protocols (SAML, OAuth)
- Biometric authentication flows
- Token revocation mechanisms
- CSRF and XSS protection

📄 [View Detailed Answer →](./answers/37-login-authentication-system.md)

---

### Distributed Job Scheduler for Background Tasks (like Airflow, Temporal)
**Refined Question:** Design a distributed task scheduler that executes millions of background jobs with dependency management, retries, priority queues, and exactly-once execution guarantees. Support cron schedules and DAG workflows.

**What Interviewer Evaluates:**
- Task orchestration understanding
- Fault tolerance in distributed systems
- Exactly-once execution semantics
- DAG execution and dependency resolution
- Worker pool management

**Key Concepts:**
- DAG (Directed Acyclic Graph) representation
- Task queue design (priority queues)
- Distributed locking (Redis, ZooKeeper)
- Idempotency and exactly-once semantics
- Worker heartbeat and failure detection
- Task retry with exponential backoff
- Cron expression parsing
- State machine for task lifecycle
- Dead letter queues
- Resource-based task assignment
- Task result persistence

📄 [View Detailed Answer →](./answers/38-distributed-job-scheduler.md)

---

### Notification System that Works at Global Scale (like SNS, FCM)
**Refined Question:** Design a multi-channel notification system (push, email, SMS, in-app) that delivers 1B notifications daily with personalization, scheduling, delivery tracking, and preference management.

**What Interviewer Evaluates:**
- Multi-channel delivery architecture
- Fan-out patterns at scale
- Delivery guarantees and retry logic
- User preference management
- Rate limiting per channel

**Key Concepts:**
- Fan-out strategies (fan-out on write vs read)
- Template engine for personalization
- Delivery status tracking (sent, delivered, read)
- Channel prioritization and fallback
- User preference store and subscription management
- Rate limiting per provider (email, SMS)
- Batch vs real-time sending
- Deduplication across channels
- A/B testing for notification content
- Mobile push notification platforms (FCM, APNs)
- Webhook for delivery callbacks

📄 [View Detailed Answer →](./answers/39-notification-system.md)

---

### A/B Testing Platform for Experiments
**Refined Question:** Design an experimentation platform that supports feature flags, gradual rollouts, multivariate testing, and statistical analysis. Enable 1000s of concurrent experiments with minimal performance impact.

📺 [Watch: A/B Testing Platform Design](https://www.youtube.com/watch?v=Hz6DxFpvh_Q)

**What Interviewer Evaluates:**
- Statistical significance understanding
- Feature flag architecture
- User bucketing strategies
- Performance impact minimization
- Data collection and analysis pipeline

**Key Concepts:**
- Consistent hashing for user bucketing
- Feature flag evaluation (client-side vs server-side)
- Statistical significance testing (t-test, chi-square)
- Multiple comparison correction (Bonferroni)
- Traffic allocation algorithms
- Experiment isolation and interaction detection
- Metrics collection pipeline
- Real-time vs batch analysis
- Gradual rollout strategies (canary, blue-green)
- Kill switches and emergency rollback
- Edge caching for flag configurations

📄 [View Detailed Answer →](./answers/40-ab-testing-platform.md)

---

### On-Call Escalation System for Incidents
**Refined Question:** Design an incident management system with multi-level escalation, acknowledgment tracking, notification delivery across channels, schedule management, and integration with monitoring systems.

**What Interviewer Evaluates:**
- Alert routing and escalation logic
- Reliability and redundancy
- Acknowledgment and de-duplication
- Schedule management complexity
- Integration patterns

**Key Concepts:**
- Escalation policy design (levels, timeouts)
- Schedule management (rotations, overrides)
- Alert deduplication and grouping
- Multi-channel notification (call, SMS, push)
- Acknowledgment tracking
- Alert suppression and maintenance windows
- Integration with monitoring (webhooks, APIs)
- High availability design (no single point of failure)
- Audit logging for compliance
- Incident timeline and post-mortem data
- Failover for notification channels

📄 [View Detailed Answer →](./answers/41-oncall-escalation-system.md)

---

### IoC or Dependency Injection Framework
**Refined Question:** Design a dependency injection container that supports constructor/property injection, lifecycle management (singleton, transient, scoped), circular dependency detection, and lazy initialization with minimal runtime overhead.

**What Interviewer Evaluates:**
- Software design patterns knowledge
- Graph algorithms (cycle detection)
- Reflection vs code generation trade-offs
- Memory management
- API design principles

**Key Concepts:**
- Constructor vs property vs method injection
- Lifetime management (singleton, transient, scoped)
- Dependency graph construction
- Circular dependency detection (DFS with cycle detection)
- Lazy initialization strategies
- Interface to implementation mapping
- Reflection vs compile-time code generation
- Generic type handling
- Decorator pattern for proxies/interceptors
- Container hierarchy (parent-child)
- Thread safety for singleton creation

📄 [View Detailed Answer →](./answers/42-ioc-dependency-injection.md)

---

### Counting and Broadcasting Likes for Very High Traffic Users (like Celebrity Posts)
**Refined Question:** Design a system to track and display like counts for viral content with millions of concurrent users. Handle race conditions, support real-time updates, and optimize for read-heavy workload with eventual consistency.

**What Interviewer Evaluates:**
- Handling hotspot/celebrity problem
- Counting at scale with eventual consistency
- Fan-out strategies for viral content
- Cache coherency
- Trade-offs between accuracy and performance

**Key Concepts:**
- Write sharding for hot keys
- Approximate counting (probabilistic counters)
- Event-driven updates (websockets, SSE)
- Cache warming and invalidation
- Fan-out on write vs fan-out on read
- Deduplication of likes
- Eventual consistency acceptance
- Anti-spam and bot detection
- Pagination for like lists
- Leaderboard computation
- Time-decay algorithms for trending content

📄 [View Detailed Answer →](./answers/43-likes-broadcasting.md)

---

### Push Notification Delivery System for Third-Party Apps and Web Apps
**Refined Question:** Design a push notification delivery system that sends notifications to mobile apps (iOS, Android) and web browsers. Support 10M devices, 1B notifications/day, third-party app integrations, and delivery tracking with 99.99% delivery rate.

📺 [Watch: Push Notification System Design](https://www.youtube.com/watch?v=CZw57SIwgiE)

**What Interviewer Evaluates:**
- Understanding of push notification protocols (APNs, FCM, WebPush)
- Handling device token management and expiry
- Delivery guarantees and retry mechanisms
- Third-party API integration patterns
- Webhook delivery for external apps

**Key Concepts:**
- APNs (Apple Push Notification service) protocol
- FCM (Firebase Cloud Messaging) architecture
- Web Push API and service workers
- Device token lifecycle management
- Push certificate management
- Delivery receipts and tracking
- Retry strategies with exponential backoff
- Webhook delivery for third-party apps
- Payload size limits and optimization
- Priority-based delivery (high, normal)
- Silent vs visible notifications
- Topic-based subscriptions
- Geotargeting and user segmentation
- Rate limiting per device
- Badge count management

📄 [View Detailed Answer →](./answers/44-push-notification-delivery.md)