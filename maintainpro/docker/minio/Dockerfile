# MinIO server and client for the isolated E2E stack, built from MinIO's official source.
#
# MinIO no longer publishes anonymously pullable images: quay.io/minio/* returns 401 and
# Docker Hub minio/minio no longer exists. This builds the same releases that
# docker-compose.yml pins, and checks each tag resolves to its known upstream commit (peeled, not the tag object) so a moved
# tag fails the build instead of silently changing the binary.
#
# Targets: `server` (minio) and `client` (mc). Used only by docker-compose.e2e.yml.

ARG GO_IMAGE=golang:1.24-alpine
ARG RUNTIME_IMAGE=alpine:3.20

FROM ${GO_IMAGE} AS build-base
RUN apk add --no-cache git ca-certificates
ENV CGO_ENABLED=0 GOFLAGS=-trimpath

FROM build-base AS build-server
ARG MINIO_RELEASE=RELEASE.2025-04-22T22-12-26Z
ARG MINIO_COMMIT=0d7408fc9969caf07de6a8c3a84f9fbb10a6739e
RUN git clone --depth 1 --branch "$MINIO_RELEASE" https://github.com/minio/minio.git /src \
 && test "$(git -C /src rev-parse HEAD)" = "$MINIO_COMMIT" \
 && cd /src && go build -o /out/minio .

FROM build-base AS build-client
ARG MC_RELEASE=RELEASE.2025-04-16T18-13-26Z
ARG MC_COMMIT=b00526b153a31b36767991a4f5ce2cced435ee8e
RUN git clone --depth 1 --branch "$MC_RELEASE" https://github.com/minio/mc.git /src \
 && test "$(git -C /src rev-parse HEAD)" = "$MC_COMMIT" \
 && cd /src && go build -o /out/mc .

FROM ${RUNTIME_IMAGE} AS server
RUN apk add --no-cache ca-certificates
COPY --from=build-server /out/minio /usr/bin/minio
EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["/usr/bin/minio"]

FROM ${RUNTIME_IMAGE} AS client
RUN apk add --no-cache ca-certificates
COPY --from=build-client /out/mc /usr/bin/mc
ENTRYPOINT ["/usr/bin/mc"]
