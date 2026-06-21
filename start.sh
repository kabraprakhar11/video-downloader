#!/bin/bash
set -e

echo "==> Updating yt-dlp and PO Token provider..."
pip3 install --break-system-packages --upgrade "yt-dlp[default]" "bgutil-ytdlp-pot-provider" --quiet
echo "==> yt-dlp version: $(yt-dlp --version)"

if [ -n "$YOUTUBE_COOKIES_BASE64" ]; then
    echo "==> Decoding YouTube cookies from environment..."
    echo "$YOUTUBE_COOKIES_BASE64" | base64 --decode > /usr/src/app/cookies.txt
    chmod 600 /usr/src/app/cookies.txt
fi

echo "==> Starting server..."
exec node --max-http-header-size=65536 server/index.js
