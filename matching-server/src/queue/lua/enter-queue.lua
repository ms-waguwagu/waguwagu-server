-- ===============================================
-- 기능: 유저의 대기열 진입 및 세션 상태 등록
-- KEYS[1] = sessionKey (session:<userId>)
-- KEYS[2] = queueKey (match_queue)
-- ARGV[1]: nickname
-- ARGV[2]: entryTime (ms)
-- ARGV[3]: ttl (seconds)
-- ARGV[4]: userId
-- ===============================================
    local sessionKey = KEYS[1]
    local queueKey = KEYS[2]

    local nickname = ARGV[1]
    local entryTime = ARGV[2]
    local ttl = tonumber(ARGV[3])
    local userId = ARGV[4]

		-- 1. 중복 진입 방지 로직
    local currentStatus = redis.call('HGET', sessionKey, 'status')
		
		-- 2. 상태에 따른 분기 처리
    if currentStatus == 'WAITING' then
        return 'DUPLICATE_ENTRY' 
    elseif currentStatus == 'IN_GAME' then
        return 'ALREADY_IN_GAME' 
    end

		-- 3. 세션 정보 저장
    redis.call('HSET', sessionKey,
      'nickname', nickname,
      'status', 'WAITING',
      'entryTime', entryTime
    )

		-- 4. 세션 정보 TTL 설정
    redis.call('EXPIRE', sessionKey, ttl)

		-- 5. 매칭 대기열에 유저 추가
    redis.call('LPUSH', queueKey, userId)

		-- 6. 마지막으로 입장한 유저 시간 저장 (전역)
    redis.call('SET', queueKey .. ':lastJoinedAt', entryTime)
		
    return userId
