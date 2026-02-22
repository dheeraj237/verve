# S3 Deployment Guide

This guide explains how to deploy Verve to a public S3 bucket.

## Prerequisites

### 1. Install AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
sudo apt-get install awscli
```

**Windows/Other:**
Visit [AWS CLI Installation Guide](https://aws.amazon.com/cli/)

### 2. Configure AWS Credentials

```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Output format (use `json`)

### 3. Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Enable static website hosting
aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html

# Configure bucket policy for public access
aws s3api put-bucket-policy --bucket your-bucket-name --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-bucket-name/*"
  }]
}'

# Disable block public access (if needed)
aws s3api put-public-access-block --bucket your-bucket-name --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

## Deployment

### Basic Deployment (S3 Only)

```bash
./deploy-s3.sh your-bucket-name
```

### With CloudFront CDN

If you have a CloudFront distribution in front of your S3 bucket:

```bash
./deploy-s3.sh your-bucket-name YOUR-CLOUDFRONT-DIST-ID
```

The script will automatically invalidate the CloudFront cache.

## Setting Up CloudFront (Optional)

CloudFront provides:
- Global CDN for faster load times
- HTTPS support with custom domain
- Better caching control

### Create CloudFront Distribution

1. **Via AWS Console:**
   - Go to CloudFront → Create Distribution
   - Origin Domain: Select your S3 bucket
   - Origin Access: Public
   - Default Root Object: `index.html`
   - Custom Error Pages: 403 → `/index.html` (for SPA routing)

2. **Via AWS CLI:**

```bash
# Get your bucket website endpoint
BUCKET_ENDPOINT="your-bucket-name.s3-website-us-east-1.amazonaws.com"

# Create distribution (save this to cf-config.json first)
aws cloudfront create-distribution --distribution-config file://cf-config.json
```

**cf-config.json example:**
```json
{
  "CallerReference": "verve-deployment-$(date +%s)",
  "Comment": "Verve CDN Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-verve",
      "DomainName": "your-bucket-name.s3-website-us-east-1.amazonaws.com",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only"
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-verve",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "Compress": true
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 403,
      "ResponsePagePath": "/index.html",
      "ResponseCode": "200",
      "ErrorCachingMinTTL": 300
    }]
  },
  "Enabled": true
}
```

## Custom Domain Setup

### 1. Using Route 53

```bash
# Create hosted zone (if you don't have one)
aws route53 create-hosted-zone --name example.com --caller-reference $(date +%s)

# Create A record pointing to CloudFront
aws route53 change-resource-record-sets --hosted-zone-id YOUR-ZONE-ID --change-batch '{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "verve.example.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "d111111abcdef8.cloudfront.net",
        "EvaluateTargetHealth": false
      }
    }
  }]
}'
```

### 2. SSL Certificate (ACM)

```bash
# Request certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name verve.example.com \
  --validation-method DNS \
  --region us-east-1

# Follow the validation instructions sent by email
```

## Environment Variables

You can customize the deployment by setting environment variables:

```bash
# Set AWS region
export AWS_REGION=eu-west-1
./deploy-s3.sh your-bucket-name

# Or inline
AWS_REGION=ap-southeast-1 ./deploy-s3.sh your-bucket-name
```

## Troubleshooting

### Access Denied Error

Make sure:
1. Bucket policy allows public read access
2. Block public access settings are disabled
3. AWS credentials have s3:PutObject permissions

### 403 Forbidden on Routes

Add CloudFront custom error response:
- Error Code: 403
- Response Page: /index.html
- Response Code: 200

### CloudFront Cache Not Updating

The deployment script automatically invalidates CloudFront cache. If issues persist:

```bash
# Manual invalidation
aws cloudfront create-invalidation \
  --distribution-id YOUR-DIST-ID \
  --paths "/*"
```

## Cost Optimization

- **S3 Storage:** ~$0.023 per GB/month
- **S3 Transfer:** First 1GB free per month, then ~$0.09 per GB
- **CloudFront:** Free tier includes 1TB transfer per month
- **Route 53:** $0.50 per hosted zone per month + $0.40 per million queries

## Security Best Practices

1. **Use CloudFront with S3 origin access identity** (more secure than public bucket)
2. **Enable CloudFront HTTPS only**
3. **Set appropriate cache headers** (already configured in script)
4. **Use AWS WAF for DDoS protection** (optional)
5. **Monitor with CloudWatch**

## Automated Deployments

### GitHub Actions (S3)

Create `.github/workflows/deploy-s3.yml`:

```yaml
name: Deploy to S3

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      
      - name: Install and Build
        run: |
          yarn install --frozen-lockfile
          yarn build
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ \
            --delete \
            --acl public-read \
            --cache-control "public, max-age=31536000" \
            --exclude "*.html"
          
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/ \
            --acl public-read \
            --cache-control "public, max-age=0, must-revalidate" \
            --content-type "text/html" \
            --exclude "*" \
            --include "*.html"
      
      - name: Invalidate CloudFront
        if: ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

Add secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID` (optional)

## Deployment Checklist

- [ ] AWS CLI installed and configured
- [ ] S3 bucket created and configured for static hosting
- [ ] Bucket policy allows public read access
- [ ] Script is executable (`chmod +x deploy-s3.sh`)
- [ ] Test deployment to bucket
- [ ] (Optional) CloudFront distribution created
- [ ] (Optional) Custom domain configured
- [ ] (Optional) SSL certificate setup

## Support

For issues or questions:
1. Check AWS CloudWatch logs
2. Verify S3 bucket policy
3. Test CloudFront distribution
4. Review AWS IAM permissions
