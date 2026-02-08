# Verve Deployment Guide

## Vercel Deployment

Verve is configured for seamless deployment on [Vercel](https://vercel.com):

### Setup Steps

1. **Connect Repository**
   - Visit [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select the repository you want to deploy

2. **Configure Build Settings**
   - Framework: Next.js
   - Build Command: `yarn build`
   - Output Directory: `.next`
   - Node.js Version: 20.x (or latest)

3. **Environment Variables**
   No additional environment variables required for basic functionality.

4. **Deploy**
   - Vercel will automatically build and deploy on every push to main/master
   - Preview deployments for pull requests are automatic

### GitHub Actions CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

1. **Tests on every push & PR**
   - Runs linter
   - Builds the application
   - Validates TypeScript

2. **Auto-deploys to Vercel**
   - Triggers on successful test
   - Only deploys from main/master branches

### Setting Up GitHub Actions for Vercel

1. **Get Vercel Tokens**
   - Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
   - Create a new token and copy it

2. **Add GitHub Secrets**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `VERCEL_TOKEN`: Your Vercel authentication token
     - `VERCEL_ORG_ID`: Your Vercel organization ID (found in Vercel dashboard)
     - `VERCEL_PROJECT_ID`: Your project ID (found in `.vercel/project.json` after first deployment)

3. **Verify Workflow**
   - Push a change to main
   - Check Actions tab to see the pipeline run
   - App should deploy automatically on success

## Local Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Open http://localhost:3000
```

## Production Build & Run

```bash
# Build
yarn build

# Start production server
yarn start

# Open http://localhost:3000
```

## Rollback

On Vercel:
1. Go to Deployments
2. Find the deployment you want to rollback to
3. Click the three dots and select "Rollback to this deployment"

## Monitoring

- **Vercel Analytics**: Built-in performance monitoring
- **Log**: Check `/logs` in Vercel dashboard
- **Serverless Functions**: Monitor API routes in Vercel dashboard

## Troubleshooting

### Build Fails
- Check `.github/workflows/deploy.yml` logs
- Verify Node.js version compatibility
- Run `yarn build` locally to test

### Deployment Issues
- Check Vercel deployment logs
- Verify environment variables are set
- Check `.vercelignore` for incorrect excludes

### Type Errors
- Run `yarn build` to catch TypeScript errors
- Check file paths in imports are correct
- Run `yarn lint` to check ESLint issues

## Feature Flags for Configuration

The app supports feature flags for customization:

- **App Title**: Configure via `APP_TITLE` in `core/config/features.ts`
- **Description**: Update `APP_DESCRIPTION` for metadata

Edit these values to customize your deployment without code changes to components.
