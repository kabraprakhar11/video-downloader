# Use official Node.js runtime as parent image
FROM node:22-slim

# Install Python3, FFmpeg, curl
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Python3 as default python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Install yt-dlp with all extras + PO Token provider (bypasses YouTube bot detection on server IPs)
RUN pip3 install --break-system-packages \
    "yt-dlp[default]" \
    "bgutil-ytdlp-pot-provider"

# Print yt-dlp version for build logs
RUN yt-dlp --version

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy server source code and public assets
COPY server/ ./server/
COPY public/ ./public/

# Copy cookies file if it exists (optional — soft copy)
COPY cookies.txt* ./

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port (Cloud Run sets PORT env var automatically)
EXPOSE 3000

# Command to run: update yt-dlp first, then start server
CMD [ "bash", "start.sh" ]
