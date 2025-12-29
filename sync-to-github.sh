#!/bin/bash
# Quick script to sync changes to GitHub
# Usage: ./sync-to-github.sh "Your commit message"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Syncing to GitHub...${NC}\n"

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}No changes to commit.${NC}"
    exit 0
fi

# Show status
echo -e "${BLUE}Changes detected:${NC}"
git status -s

# Add all changes
echo -e "\n${BLUE}Adding all changes...${NC}"
git add .

# Commit with message
if [ -z "$1" ]; then
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$1"
fi

echo -e "\n${BLUE}Committing: ${COMMIT_MSG}${NC}"
git commit -m "$COMMIT_MSG"

# Push to GitHub
echo -e "\n${BLUE}Pushing to GitHub...${NC}"
git push

echo -e "\n${GREEN}✅ Successfully synced to GitHub!${NC}"
echo -e "${BLUE}View at: https://github.com/tumblegymmysore/tgm-spotter${NC}\n"

