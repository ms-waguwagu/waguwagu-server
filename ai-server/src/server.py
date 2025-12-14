import asyncio
import random
import grpc

from src.ai import ai_pb2, ai_pb2_grpc


class BossAIService(ai_pb2_grpc.BossAIServiceServicer):
    async def PredictAction(self, request, context):
        # request: GameState

        # 간단한 멍청이 봇 로직:
        # - move_x, move_y를 -1 ~ 1 사이 랜덤
        # - 가끔 스킬 사용
        move_x = random.uniform(-1, 1)
        move_y = random.uniform(-1, 1)
        use_skill = random.random() < 0.1  # 10% 확률
        skill_name = "dash" if use_skill else ""

        return ai_pb2.AIAction(
            move_x=move_x,
            move_y=move_y,
            use_skill=use_skill,
            skill_name=skill_name,
        )


async def serve():
    server = grpc.aio.server()
    ai_pb2_grpc.add_BossAIServiceServicer_to_server(
        BossAIService(), server
    )
    server.add_insecure_port("[::]:50051")
    print("Boss AI gRPC server listening on 0.0.0.0:50051")
    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())

