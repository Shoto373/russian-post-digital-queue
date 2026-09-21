#!/usr/bin/env bash
# Server Optimization Script for SUO Hackathon
set -euo pipefail

echo "=== 1. Updating docker-compose.yml restart policy ==="
COMPOSE_FILE="/root/tsifrovaya-ochered-novogo-pokoleniya/docker-compose.yml"
if [ -f "$COMPOSE_FILE" ]; then
    sed -i 's/restart: unless-stopped/restart: always/g' "$COMPOSE_FILE"
    echo "Updated $COMPOSE_FILE with restart: always."
fi

echo "=== 2. Applying restart: always to all running containers ==="
RUNNING_CONTAINERS=$(docker ps -q)
if [ -n "$RUNNING_CONTAINERS" ]; then
    # shellcheck disable=SC2086
    docker update --restart=always $RUNNING_CONTAINERS
    echo "Updated running containers with restart: always."
fi

echo "=== 3. Configuring Docker daemon log rotation ==="
DAEMON_JSON="/etc/docker/daemon.json"
cat << 'EOF' > "$DAEMON_JSON"
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
EOF
systemctl reload docker || true
echo "Docker daemon logging configured."

echo "=== 4. Applying Linux Kernel & Network Tuning ==="
SYSCTL_CONF="/etc/sysctl.d/99-server-tuning.conf"
cat << 'EOF' > "$SYSCTL_CONF"
# Virtual Memory: avoid aggressive swapping on 2GB RAM
vm.swappiness = 10
vm.vfs_cache_pressure = 50

# Network stack tuning for high concurrency
net.core.somaxconn = 8192
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 10240 65535

# File descriptors and inotify
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 1024
EOF
sysctl --system > /dev/null 2>&1 || sysctl -p "$SYSCTL_CONF"
echo "Kernel parameters applied."

echo "=== 5. Optimizing Nginx High Performance Settings ==="
# Update main nginx.conf
NGINX_CONF="/etc/nginx/nginx.conf"
python3 -c '
import re
path = "/etc/nginx/nginx.conf"
content = open(path).read()
# Increase worker connections
content = re.sub(r"worker_connections\s+\d+;", "worker_connections 4096;\n\tmulti_accept on;", content)
# Server tokens off
if "server_tokens off;" not in content:
    content = content.replace("sendfile on;", "sendfile on;\n\tserver_tokens off;")
# Drop old SSLv1/v1.1 protocols at top level
content = re.sub(r"ssl_protocols\s+TLSv1\s+TLSv1\.1\s+TLSv1\.2\s+TLSv1\.3;", "ssl_protocols TLSv1.2 TLSv1.3;", content)
open(path, "w").write(content)
'
nginx -t && systemctl reload nginx
echo "Nginx optimized and reloaded."

echo "=== 6. Pruning old Docker build cache and dangling images ==="
docker image prune -f > /dev/null 2>&1 || true
docker builder prune -af --filter "until=48h" > /dev/null 2>&1 || true
echo "Docker cache cleaned."

echo "=== 7. Verification ==="
echo "Memory:"
free -m
echo "Disk:"
df -h /
echo "Container Restart Policies:"
docker inspect -f '{{.Name}}: {{.HostConfig.RestartPolicy.Name}}' $(docker ps -q)
echo "Done!"
