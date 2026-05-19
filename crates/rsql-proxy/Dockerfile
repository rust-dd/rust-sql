# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: frontend — build the web bundle
# ============================================================
FROM node:24-alpine AS frontend
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN VITE_BUILD_TARGET=web yarn build

# ============================================================
# Stage 2: rust-build — compile rsql-proxy against musl
# ============================================================
FROM rust:1.89-alpine AS rust-build
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconfig

WORKDIR /build
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true \
    OPENSSL_STATIC=1 \
    OPENSSL_NO_VENDOR=1

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN cargo build --release --bin rsql-proxy

# ============================================================
# Stage 3: runtime — minimal Alpine + binary + dist
# ============================================================
FROM alpine:3.20
RUN apk add --no-cache ca-certificates

COPY --from=rust-build /build/target/release/rsql-proxy /usr/local/bin/rsql-proxy
COPY --from=frontend   /app/dist                       /app/dist

ENV RSQL_BIND=0.0.0.0:8080 \
    RSQL_DIST_DIR=/app/dist \
    RSQL_STATE_PATH=/data/rsql.db \
    RUST_LOG=info,rsql_proxy=info

VOLUME /data
EXPOSE 8080
ENTRYPOINT ["rsql-proxy"]
