#!/usr/bin/env sh
set -eu
npm test
npm run build:ui
npm run test:ui
