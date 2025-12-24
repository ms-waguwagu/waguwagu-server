#!/bin/bash
set -e

MATCHING_CTX=arn:aws:eks:ap-northeast-2:061039804626:cluster/T3-Wagu-Matching-EKS
WORKDIR=/tmp/agones-mtls

kubectl config use-context $MATCHING_CTX

kubectl get ns matching || kubectl create ns matching

# matching-deploy.yaml의 volumes secretName 참조
echo "▶ 기존 Secret 정리"
kubectl delete secret allocator-client allocator-ca -n matching --ignore-not-found

# matching-deploy.yaml의 volumes secretName 참조
echo "▶ allocator-client 생성"
kubectl -n matching create secret tls allocator-client \
  --cert=$WORKDIR/client.crt \
  --key=$WORKDIR/client.key

# matching-deploy.yaml의 volumes secretName 참조
echo "▶ allocator-ca 생성"
kubectl -n matching create secret generic allocator-ca \
  --from-file=tls-ca.crt=$WORKDIR/ca.crt

kubectl get secret -n matching | grep allocator
