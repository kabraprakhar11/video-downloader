#!/bin/bash
set -e

echo "==> Updating yt-dlp and PO Token provider..."
pip3 install --break-system-packages --upgrade "yt-dlp[default]" "bgutil-ytdlp-pot-provider" --quiet
echo "==> yt-dlp version: $(yt-dlp --version)"

echo "==> Starting server..."
exec node --max-http-header-size=65536 server/index.js
