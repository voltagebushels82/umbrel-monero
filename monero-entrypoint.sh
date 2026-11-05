#!/bin/sh
set -eu
# Wait for the dashboard to create the shared configuration before first boot.
config="${MONERO_CONF_FILE:-/home/monero/.bitmonero/bitmonero.conf}"
until [ -s "$config" ]; do sleep 1; done
exec /entrypoint.sh "--config-file=$config" "$@"
