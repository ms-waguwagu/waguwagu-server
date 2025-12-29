#!/bin/bash
set -e

MATCHING_CTX="arn:aws:eks:ap-northeast-2:061039804626:cluster/T3-Wagu-Matching-EKS" 
 

echo "▶ 매칭 클러스터로 전환" 
kubectl config use-context "$MATCHING_CTX"

echo "▶ matching-ingress ALB 대기"
kubectl wait --for=jsonpath='{.status.loadBalancer.ingress[0].hostname}' \
  ingress/matching-ingress -n matching --timeout=10m

MATCHING_DNS=$(kubectl get ingress matching-ingress -n matching \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Matching ALB: $MATCHING_DNS"

echo "▶ CloudFront 배포"
aws cloudformation deploy \
  --template-file T3-Wagu-Cloudfront.yaml \
  --stack-name T3-Wagu-Cloudfront \
  --parameter-overrides \
    MatchingAlbDns=$MATCHING_DNS \
  --capabilities CAPABILITY_NAMED_IAM
