import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================
// 환경 변수
// ==============================
// const BASE_URL = __ENV.API_BASE_URL || 'https://www.waguwagu.cloud';
const BASE_URL = __ENV.API_BASE_URL || 'https://www.mswagu.cloud';

// ⚠️ 실제 Google OAuth로 발급받은 idToken (테스트용 계정)
// 여러 개면 배열로 만들어도 됨
const TEST_ID_TOKEN = __ENV.GOOGLE_ID_TOKEN;

// ==============================
// k6 옵션
// ==============================
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // 워밍업
    { duration: '1m', target: 200 }, // 실전 부하
    { duration: '30s', target: 0 }, // 철수
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // 에러율 1% 미만
    http_req_duration: ['p(95)<800'],
  },
};

// ==============================
// 메인 시나리오
// ==============================
export default function () {
  // 1️. Google 로그인
  const loginRes = http.post(
    `${BASE_URL}/auth/google`,
    JSON.stringify({
      idToken: TEST_ID_TOKEN,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(loginRes, {
    'google login success': (r) => r.status === 200 || r.status === 201,
    'accessToken exists': (r) => !!r.json('accessToken'),
  });

  const accessToken = loginRes.json('accessToken');
  const isNewUser = loginRes.json('isNewUser');

  // 2️. 신규 유저면 닉네임 설정
  if (isNewUser) {
    const nickname = `u${__VU}${__ITER}`.slice(0, 10);

    const nicknameRes = http.post(
      `${BASE_URL}/auth/nickname`,
      JSON.stringify({
        nickname,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    check(nicknameRes, {
      'nickname set success': (r) => r.status === 200,
    });

    if (nicknameRes.status >= 400) {
      console.log(
        `nickname failed: status=${nicknameRes.status} body=${nicknameRes.body}`,
      );
    }
  }

  // 3. 잠깐 숨 고르기 (실유저 흉내)
  sleep(1);
}
