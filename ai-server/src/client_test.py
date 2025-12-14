import asyncio
import grpc

from src.ai import ai_pb2, ai_pb2_grpc  

async def main():
    async with grpc.aio.insecure_channel("localhost:50051") as channel:
        stub = ai_pb2_grpc.BossAIServiceStub(channel)

        game_state = ai_pb2.GameState(
            room_id="room-123",
            tick=1,
            map_width=20,
            map_height=20,
            boss_x=10,
            boss_y=10,
            remaining_dots=50,
            boss_hp=100,
            boss_phase=1,
        )

        # 플레이어 2명 추가
        p1 = game_state.players.add()
        p1.id = "p1"
        p1.x = 5
        p1.y = 5
        p1.is_alive = True

        p2 = game_state.players.add()
        p2.id = "p2"
        p2.x = 15
        p2.y = 15
        p2.is_alive = True

        action = await stub.PredictAction(game_state)
        print("AI Action:", action)

if __name__ == "__main__":
    asyncio.run(main())
