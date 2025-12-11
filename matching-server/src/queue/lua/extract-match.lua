-- ===============================================
-- 기능: 대기열 길이가 count(기본 5) 이상일 때만, 정확히 count만큼 유저를 추출
-- ARGV[1]: count (추출할 인원 수, 기본값 5)
-- ===============================================

local queueKey = KEYS[1]
local count = tonumber(ARGV[1])

-- 1. 대기열 길이 확인 (LLEN)
-- 5명보다 적으면 아예 건드리지 않고 nil 리턴
if redis.call('LLEN', queueKey) < count then
  return nil
end

-- 2. 5명 이상이면 정확히 count만큼 뒤에서(오래된 순) 꺼냄
return redis.call('RPOP', queueKey, count)