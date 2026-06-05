# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --silent

COPY . .

# Las env vars de build se inyectan como build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Stage 2: serve
FROM nginx:1.27-alpine AS server

# Configuración de nginx con headers de seguridad
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build de Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
