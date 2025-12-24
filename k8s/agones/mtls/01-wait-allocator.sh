#!/bin/bash
set -e

GAME_CTX=arn:aws:eks:ap-northeast-2:061039804626:cluster/T3-Wagu-Game-EKS

kubectl config use-context $GAME_CTX

echo "▶ allocator Service 대기"
kubectl wait svc \
  -n agones-system \
  --for=jsonpath='{.status.loadBalancer.ingress[0].hostname}' \
  agones-allocator \
  --timeout=300s

echo "▶ allocator LB 주소:"
kubectl get svc agones-allocator -n agones-system
