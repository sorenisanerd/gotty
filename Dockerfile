FROM golang:1.16

WORKDIR /gotty
COPY . /gotty
RUN apt-get update -qq && apt-get install -qq nodejs npm
RUN CGO_ENABLED=0 make

FROM ubuntu:22.04

ENV TERM=linux
RUN apt-get update -qq && \
    apt-get install -qq ca-certificates bash lrzsz && \
    apt-get upgrade -qq
WORKDIR /root
COPY --from=0 /gotty/gotty /usr/bin/
CMD ["gotty",  "-w", "bash"]
