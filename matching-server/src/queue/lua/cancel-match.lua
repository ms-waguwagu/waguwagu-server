-- ===============================================
-- 기능: 대기열에서 유저를 제거하고 상태를 IDLE로 변경
-- ARGV[1]: userId
-- ===============================================

local sessionKey = KEYS[1]
local queueKey = KEYS[2]
local userId = ARGV[1]

-- 1. 현재 상태 확인
local currentStatus = redis.call('HGET', sessionKey, 'status')

-- 이미 게임 중이라면 취소 불가
if currentStatus == 'IN_GAME' then
    return 'ALREADY_IN_GAME'
end

-- 2. 대기열에서 유저 삭제 시도
local removedCount = redis.call('LREM', queueKey, 0, userId)

if removedCount > 0 then
    -- 3. 리스트에서 삭제 성공 시 -> 상태를 IDLE로 변경 (취소 성공)
    redis.call('HSET', sessionKey, 'status', 'IDLE')
    return 'CANCELLED'
else
    -- 4. 리스트에 없음 (이미 매칭되었거나, 원래 없었음)
    if currentStatus == 'WAITING' then
        -- 상태는 WAITING인데 리스트에 없다? -> 방금 매칭워커가 가져간 경우 (매칭 확정)
        return 'ALREADY_MATCHED_BY_WORKER'
    else
        -- 원래 대기열에 없던 유저
        return 'NOT_QUEUED'
    end
end