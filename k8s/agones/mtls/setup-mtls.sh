#!/bin/bash
set -e

./01-wait-allocator.sh
./02-extract-mtls.sh
./03-apply-to-matching.sh

echo "✅ mTLS setup 완료"
