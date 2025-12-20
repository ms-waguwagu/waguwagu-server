#!/bin/bash
set -e

GAME_CTX=arn:aws:eks:ap-northeast-2:796973515852:cluster/T3-Wagu-Game-EKS
WORKDIR=/tmp/agones-mtls

mkdir -p $WORKDIR
cd $WORKDIR

kubectl config use-context $GAME_CTX

echo "▶ allocator client cert 추출"
kubectl get secret allocator-client.default -n game \
  -o jsonpath='{.data.tls\.crt}' | base64 -d > client.crt

kubectl get secret allocator-client.default -n game \
  -o jsonpath='{.data.tls\.key}' | base64 -d > client.key

echo "▶ allocator CA cert 추출"
kubectl get secret allocator-tls-ca -n agones-system \
  -o jsonpath='{.data.tls-ca\.crt}' | base64 -d > ca.crt

echo "▶ 파일 확인"
ls -al

# kubectl get secret -A | grep allocator-client 으로 실제 이름 확인
