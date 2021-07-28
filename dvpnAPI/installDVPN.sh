#!/bin/bash
#install dvpn-node
mkdir -p ${HOME}/.HandyHost/sentinelData && \
git clone https://github.com/sentinel-official/dvpn-node.git ${HOME}/.HandyHost/sentinelData/dvpn-node && \
cd ${HOME}/dvpn-node && \
docker build --file Dockerfile \
--tag sentinel-dvpn-node \
--force-rm \
--no-cache \
--compress .