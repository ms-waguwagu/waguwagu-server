#!/bin/bash
set -e

MATCHING_CTX=arn:aws:eks:ap-northeast-2:796973515852:cluster/T3-Wagu-Matching-EKS
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
kubectl -n matching create secret generic allocator-ca \
  --from-file=tls-ca.crt=$WORKDIR/ca.crt

echo "▶ matching-deploy 엔드포인트 업데이트"
ALLOCATOR_DNS=$(cat $WORKDIR/allocator-hostname)
ALLOCATOR_ENDPOINT="https://$ALLOCATOR_DNS"

kubectl set env deployment/matching-deploy AGONES_ALLOCATOR_ENDPOINT=$ALLOCATOR_ENDPOINT -n matching

echo "✅ 업데이트 완료: $ALLOCATOR_ENDPOINT"
kubectl get secret -n matching | grep allocator
