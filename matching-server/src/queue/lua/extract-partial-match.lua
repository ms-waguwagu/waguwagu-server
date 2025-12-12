-- ===============================================
-- 기능: 큐에서 최대 maxCount 명까지 꺼냄 (5명 미만이어도 OK)
-- KEYS[1] = queueKey (match_queue)
-- ARGV[1] = maxCount (예: 5)
-- ===============================================

local queueKey = KEYS[1]
local maxCount = tonumber(ARGV[1])

-- 길이가 0이면 nil
local length = redis.call('LLEN', queueKey)
if length == 0 then
  return nil
end

-- 1~5명 있으면 그만큼 RPOP으로 꺼냄
local count = maxCount
if length < maxCount then
  count = length
end

return redis.call('RPOP', queueKey, count)
