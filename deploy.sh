#!/bin/bash
# Script de deployment en el VPS Hetzner
# Ejecutar como: bash deploy.sh

set -e

echo "→ Actualizando código..."
git pull

echo "→ Rebuilding imagen Docker..."
docker compose build --no-cache

echo "→ Reiniciando contenedor..."
docker compose up -d

echo "→ Limpiando imágenes antiguas..."
docker image prune -f

echo "✓ Deploy completado"
docker compose ps
