#!/bin/bash

# Pact Deployment Script for Movement Testnet
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Pact Deployment Script"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if movement CLI is installed
if ! command -v movement &> /dev/null; then
    echo -e "${RED}❌ Movement CLI not found!${NC}"
    echo "Please install Movement CLI: https://docs.movementlabs.xyz"
    exit 1
fi

echo -e "${GREEN}✅ Movement CLI found${NC}"

# Change to modules directory
cd "$(dirname "$0")/../modules"

# Step 1: Compile
echo ""
echo -e "${BLUE}📦 Step 1: Compiling Move modules...${NC}"
movement move compile

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compilation successful${NC}"
else
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi

# Step 2: Run tests
echo ""
echo -e "${BLUE}🧪 Step 2: Running tests...${NC}"
movement move test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi

# Step 3: Deploy
echo ""
echo -e "${BLUE}🌐 Step 3: Deploying to Movement Testnet...${NC}"
echo "This will publish the Pact module to your account."
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    movement move publish --named-addresses pact_addr=default
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Initialize the protocol: movement move run --function-id 'default::pact::initialize'"
        echo "2. Get your account address: movement account list"
        echo "3. Fund with testnet MOVE: https://faucet.movementlabs.xyz"
        echo "4. Create your first pact using the examples in README.md"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
else
    echo "Deployment cancelled."
    exit 0
fi

