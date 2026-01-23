# Version Control - Answers

## Question 1: Git Branching Strategy & Hotfixes

📋 **[Back to Question](../sse-topics.md#version-control)** | **Topic:** Version control practices

**Detailed Answer:**

#### Git Branching Strategies Comparison

```mermaid
gitgraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Feature work"
    branch feature/user-auth
    checkout feature/user-auth
    commit id: "Add login"
    commit id: "Add logout"
    checkout develop
    merge feature/user-auth
    branch release/1.0
    checkout release/1.0
    commit id: "RC1"
    checkout main
    merge release/1.0 tag: "v1.0.0"
    checkout develop
    merge release/1.0
    checkout main
    branch hotfix/security-patch
    commit id: "Fix CVE"
    checkout main
    merge hotfix/security-patch tag: "v1.0.1"
    checkout develop
    merge hotfix/security-patch
```

#### Strategy 1: Git Flow

**Branch Structure:**

```
main (production)
  └── release/1.0 (release candidates)
      └── develop (integration)
          ├── feature/user-auth
          ├── feature/payment
          └── feature/notifications
  └── hotfix/critical-bug (emergency fixes)
```

**Git Flow Implementation:**

```bash
# 1. Initialize Git Flow
git flow init

# Prompted for branch names (use defaults or customize):
# Production branch: main
# Development branch: develop
# Feature prefix: feature/
# Release prefix: release/
# Hotfix prefix: hotfix/
# Support prefix: support/

# 2. Start a new feature
git flow feature start user-authentication
# Creates: feature/user-authentication from develop

# Work on feature
git add .
git commit -m "Implement JWT authentication"
git commit -m "Add password hashing"

# 3. Finish feature (merges to develop)
git flow feature finish user-authentication
# - Merges feature/user-authentication into develop
# - Deletes feature/user-authentication
# - Switches to develop

# 4. Start a release
git flow release start 1.0.0
# Creates: release/1.0.0 from develop

# Bug fixes on release branch
git commit -m "Fix typo in error message"
git commit -m "Update version number"

# 5. Finish release
git flow release finish 1.0.0
# - Merges release/1.0.0 into main
# - Tags main with v1.0.0
# - Merges release/1.0.0 back into develop
# - Deletes release/1.0.0
# - Switches to develop

# 6. Hotfix for production
git flow hotfix start critical-security-fix
# Creates: hotfix/critical-security-fix from main

git commit -m "Fix SQL injection vulnerability"

# 7. Finish hotfix
git flow hotfix finish critical-security-fix
# - Merges into main
# - Tags with version (e.g., v1.0.1)
# - Merges back into develop
# - Deletes hotfix branch
```

**Manual Git Flow (without git-flow tool):**

```bash
# Feature branch
git checkout develop
git checkout -b feature/user-auth
# ... work ...
git checkout develop
git merge --no-ff feature/user-auth
git branch -d feature/user-auth
git push origin develop

# Release branch
git checkout develop
git checkout -b release/1.0.0
# ... bug fixes ...
git checkout main
git merge --no-ff release/1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git checkout develop
git merge --no-ff release/1.0.0
git branch -d release/1.0.0
git push origin main develop --tags

# Hotfix
git checkout main
git checkout -b hotfix/security-patch
# ... fix ...
git commit -m "Fix security vulnerability"
git checkout main
git merge --no-ff hotfix/security-patch
git tag -a v1.0.1 -m "Hotfix 1.0.1"
git checkout develop
git merge --no-ff hotfix/security-patch
git branch -d hotfix/security-patch
git push origin main develop --tags
```

**Pros:**
- Clear separation of development, release, and production code
- Supports multiple releases in parallel
- Good for scheduled releases

**Cons:**
- Complex for small teams
- Slower for continuous deployment
- Merge conflicts when hotfixes applied

#### Strategy 2: GitHub Flow

**Simpler workflow:**

```
main (always deployable)
  ├── feature/add-comments
  ├── feature/improve-search
  └── bugfix/fix-logout
```

**GitHub Flow Workflow:**

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/add-payment-method

# 2. Make changes
git add .
git commit -m "Add Stripe integration"
git commit -m "Add payment form UI"

# 3. Push to remote
git push origin feature/add-payment-method

# 4. Open Pull Request on GitHub
# - Code review
# - CI/CD runs tests
# - Request changes or approve

# 5. Merge PR (via GitHub UI)
# - Squash and merge (clean history)
# - Merge commit (preserve all commits)
# - Rebase and merge (linear history)

# 6. Deploy main to production
# - Automated via CI/CD
# - Or manual deployment trigger

# 7. Delete feature branch
git branch -d feature/add-payment-method
git push origin --delete feature/add-payment-method
```

**Hotfix in GitHub Flow:**

```bash
# Same as feature - just prioritized
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-patch

git commit -m "Fix XSS vulnerability"
git push origin hotfix/critical-security-patch

# Create PR, fast-track review, merge immediately
# Deploy to production ASAP
```

**Pros:**
- Simple and easy to understand
- Continuous deployment friendly
- Fast iteration

**Cons:**
- No release branches (difficult for versioned releases)
- Main must always be deployable
- Hotfixes not distinguished from features

#### Strategy 3: Trunk-Based Development

**Single main branch:**

```
main
  └── Short-lived feature branches (< 1 day)
```

**Trunk-Based Workflow:**

```bash
# 1. Pull latest
git checkout main
git pull origin main

# 2. Create short-lived branch
git checkout -b feat/quick-fix

# 3. Small commits, push frequently
git commit -m "Update validation logic"
git push origin feat/quick-fix

# 4. Merge same day
git checkout main
git merge feat/quick-fix
git push origin main

# 5. Deploy continuously
# Every commit to main triggers deployment
```

**Feature Flags for incomplete features:**

```java
@Service
public class PaymentService {
    
    @Autowired
    private FeatureFlagService featureFlags;
    
    public PaymentResult processPayment(PaymentRequest request) {
        if (featureFlags.isEnabled("new-payment-gateway")) {
            // New feature (work in progress)
            return newPaymentGateway.process(request);
        } else {
            // Existing stable feature
            return legacyPaymentGateway.process(request);
        }
    }
}
```

**Hotfix in Trunk-Based:**

```bash
# Hotfix directly on main
git checkout main
git pull origin main

# Fix and commit
git commit -m "HOTFIX: Fix critical payment bug"
git push origin main

# Immediate deployment
# CI/CD deploys within minutes
```

**Pros:**
- Simplest workflow
- Fastest integration
- Encourages small, frequent commits

**Cons:**
- Requires strong CI/CD and testing
- Incomplete features need feature flags
- Not suitable for versioned releases

#### Hotfix Best Practices

**Scenario: Critical bug in production (v1.2.3)**

```bash
# 1. Create hotfix from production tag
git checkout -b hotfix/payment-crash v1.2.3

# 2. Fix the bug
git commit -m "Fix null pointer in payment processing"

# 3. Version bump
# Update version to 1.2.4
git commit -m "Bump version to 1.2.4"

# 4. Merge to main and tag
git checkout main
git merge --no-ff hotfix/payment-crash
git tag -a v1.2.4 -m "Hotfix: Payment crash"

# 5. Merge back to develop
git checkout develop
git merge --no-ff hotfix/payment-crash

# 6. Resolve conflicts if any
# develop may have moved forward

# 7. Push everything
git push origin main develop --tags

# 8. Deploy v1.2.4 to production
./deploy.sh v1.2.4

# 9. Clean up
git branch -d hotfix/payment-crash
git push origin --delete hotfix/payment-crash
```

**Hotfix Checklist:**

```markdown
## Hotfix Checklist

- [ ] Create hotfix branch from production tag
- [ ] Write failing test that reproduces bug
- [ ] Fix bug
- [ ] Verify test passes
- [ ] Update CHANGELOG.md
- [ ] Bump version number
- [ ] Merge to main
- [ ] Tag new version
- [ ] Merge back to develop
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Notify team in Slack
- [ ] Create post-mortem document
```

#### Real-World Team Workflow

**Team Size: 5-10 developers**

```bash
# Developer workflow
git checkout develop
git pull origin develop
git checkout -b feature/MY-TICKET-123-add-analytics

# Use conventional commits
git commit -m "feat: add Google Analytics integration"
git commit -m "test: add analytics tracking tests"
git commit -m "docs: update README with analytics setup"

# Push and create PR
git push origin feature/MY-TICKET-123-add-analytics

# On GitHub:
# 1. Create Pull Request
# 2. Add description and screenshots
# 3. Link to Jira ticket
# 4. Request reviews from 2 teammates
# 5. CI runs: tests, linting, security scan
# 6. Address review comments
# 7. Squash and merge to develop

# Release process (every 2 weeks)
# Release manager creates release branch
git checkout develop
git checkout -b release/2.5.0

# QA tests release branch
# Bug fixes committed to release branch
git commit -m "fix: typo in error message"

# Merge to main
git checkout main
git merge --no-ff release/2.5.0
git tag -a v2.5.0 -m "Release 2.5.0"

# Back-merge to develop
git checkout develop
git merge --no-ff release/2.5.0

# Deploy
kubectl set image deployment/api api=myapp:v2.5.0
```

#### Git Aliases for Efficiency

```bash
# ~/.gitconfig
[alias]
    # Quick status
    st = status -sb
    
    # Pretty log
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit
    
    # Undo last commit
    undo = reset HEAD~1 --mixed
    
    # Amend without editing message
    amend = commit -a --amend --no-edit
    
    # Delete merged branches
    cleanup = "!git branch --merged | grep -v '\\*' | xargs -n 1 git branch -d"
    
    # Quick feature start
    feature = "!f() { git checkout develop && git pull && git checkout -b feature/$1; }; f"
    
    # Quick hotfix
    hotfix = "!f() { git checkout main && git pull && git checkout -b hotfix/$1; }; f"
```

#### Comparison Summary

| Strategy | Team Size | Release Type | Complexity | Best For |
|----------|-----------|--------------|------------|----------|
| **Git Flow** | Medium-Large | Scheduled releases | High | Traditional software releases |
| **GitHub Flow** | Small-Medium | Continuous | Low | SaaS, continuous deployment |
| **Trunk-Based** | Small-Large | Continuous | Very Low | High-velocity teams, strong CI/CD |

**My Recommendation:**
- **Startups/Small teams:** GitHub Flow
- **Enterprise/Multiple versions:** Git Flow
- **High-velocity/Strong CI/CD:** Trunk-Based Development

---

