#!/bin/bash

###############################################################################
# S3 Deployment Script for Verve
# 
# This script builds the application and deploys it to a public S3 bucket.
# 
# Prerequisites:
# - AWS CLI installed and configured (aws configure)
# - S3 bucket created and configured for static website hosting
# - Appropriate IAM permissions for S3 operations
#
# Usage:
#   ./deploy-s3.sh <bucket-name> [cloudfront-distribution-id]
#
# Example:
#   ./deploy-s3.sh my-verve-bucket
#   ./deploy-s3.sh my-verve-bucket E1234ABCD5678
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="${1}"
CLOUDFRONT_ID="${2}"
BUILD_DIR="dist"
AWS_REGION="${AWS_REGION:-ap-south-1}"

###############################################################################
# Helper Functions
###############################################################################

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_requirements() {
    print_info "Checking requirements..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first:"
        echo "  macOS: brew install awscli"
        echo "  Linux: sudo apt-get install awscli"
        echo "  Other: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run: aws configure"
        exit 1
    fi
    
    # Check if yarn is installed
    if ! command -v yarn &> /dev/null; then
        print_error "Yarn is not installed. Please install it first."
        exit 1
    fi
    
    print_success "All requirements met"
}

validate_bucket() {
    print_info "Validating S3 bucket: ${BUCKET_NAME}"
    
    if ! aws s3 ls "s3://${BUCKET_NAME}" &> /dev/null; then
        print_error "Bucket '${BUCKET_NAME}' does not exist or is not accessible"
        print_info "To create a bucket, run:"
        echo "  aws s3 mb s3://${BUCKET_NAME} --region ${AWS_REGION}"
        exit 1
    fi
    
    print_success "Bucket validated"
}

build_project() {
    print_info "Building project..."
    
    # Clean previous build
    if [ -d "${BUILD_DIR}" ]; then
        rm -rf "${BUILD_DIR}"
        print_info "Cleaned previous build"
    fi
    
    # Install dependencies and build
    yarn install --frozen-lockfile
    yarn build
    
    if [ ! -d "${BUILD_DIR}" ]; then
        print_error "Build failed - ${BUILD_DIR} directory not found"
        exit 1
    fi
    
    print_success "Build completed"
}

deploy_to_s3() {
    print_info "Deploying to S3 bucket: ${BUCKET_NAME}"
    
    # Sync files to S3 with appropriate cache headers
    aws s3 sync "${BUILD_DIR}/" "s3://${BUCKET_NAME}/" \
        --delete \
        --cache-control "public, max-age=31536000" \
        --exclude "*.html" \
        --exclude "*.json" \
        --region "${AWS_REGION}"
    
    # Upload HTML and JSON files with shorter cache
    aws s3 sync "${BUILD_DIR}/" "s3://${BUCKET_NAME}/" \
        --cache-control "public, max-age=0, must-revalidate" \
        --content-type "text/html" \
        --exclude "*" \
        --include "*.html" \
        --region "${AWS_REGION}"
    
    aws s3 sync "${BUILD_DIR}/" "s3://${BUCKET_NAME}/" \
        --cache-control "public, max-age=0, must-revalidate" \
        --content-type "application/json" \
        --exclude "*" \
        --include "*.json" \
        --region "${AWS_REGION}"
    
    print_success "Files uploaded to S3"
}

invalidate_cloudfront() {
    if [ -z "${CLOUDFRONT_ID}" ]; then
        print_warning "No CloudFront distribution ID provided, skipping cache invalidation"
        return
    fi
    
    print_info "Invalidating CloudFront cache: ${CLOUDFRONT_ID}"
    
    aws cloudfront create-invalidation \
        --distribution-id "${CLOUDFRONT_ID}" \
        --paths "/*" \
        --output text > /dev/null
    
    print_success "CloudFront cache invalidation initiated"
}

print_completion() {
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    print_info "Deployment details:"
    echo "  • Bucket: ${BUCKET_NAME}"
    echo "  • Region: ${AWS_REGION}"
    
    # Get bucket website endpoint
    WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${AWS_REGION}.amazonaws.com"
    echo "  • Website URL: ${WEBSITE_URL}"
    
    if [ -n "${CLOUDFRONT_ID}" ]; then
        # Get CloudFront domain name
        CF_DOMAIN=$(aws cloudfront get-distribution --id "${CLOUDFRONT_ID}" --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
        if [ -n "${CF_DOMAIN}" ]; then
            echo "  • CloudFront URL: https://${CF_DOMAIN}"
        fi
    fi
    echo ""
}

###############################################################################
# Main Script
###############################################################################

main() {
    echo ""
    print_info "Starting S3 deployment for Verve"
    echo ""
    
    # Validate arguments
    if [ -z "${BUCKET_NAME}" ]; then
        print_error "Usage: $0 <bucket-name> [cloudfront-distribution-id]"
        echo ""
        echo "Examples:"
        echo "  $0 my-verve-bucket"
        echo "  $0 my-verve-bucket E1234ABCD5678"
        echo ""
        exit 1
    fi
    
    # Run deployment steps
    check_requirements
    validate_bucket
    build_project
    deploy_to_s3
    invalidate_cloudfront
    print_completion
}

# Run main function
main
