# The JS bundle is platform-independent, so build it once on the build
# platform rather than per target. This also means the stage does not need a
# base image for every target platform — node:24 no longer publishes
# linux/arm/v7, which the final image still targets.
FROM --platform=$BUILDPLATFORM node:24 AS js-build
WORKDIR /gotty
COPY js /gotty/js
COPY Makefile /gotty/
RUN make bindata/static/js/gotty.js.map

FROM golang:1.26 AS go-build
WORKDIR /gotty
COPY . /gotty
COPY --from=js-build /gotty/js/node_modules /gotty/js/node_modules
COPY --from=js-build /gotty/bindata/static/js /gotty/bindata/static/js
RUN CGO_ENABLED=0 make

FROM alpine:3.24
RUN apk --no-cache add ca-certificates bash
WORKDIR /root
COPY --from=go-build /gotty/gotty /usr/bin/
CMD ["gotty",  "-w", "bash"]
