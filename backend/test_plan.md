## Test Plan (Unit + Integration)

### 1) 목표
- 트랜잭션/보상(cleanup) 같은 “로직의 제어 흐름”을 유닛 테스트로 빠르게 검증한다.
- 추후에는 통합 테스트로 실제 DB/S3 연동까지 검증한다.
- 범위가 넓어지는 것을 막기 위해, 이번 문서에서는 “구현 방법/폴더 구조/테스트 전략”을 중심으로 정리한다.

### 2) 테스트 레이어 구분

#### 2.1 Unit Test (빠르고 결정적)
- 대상
  - `backend/src/controllers/postController.js`
  - `backend/src/services/*` (필요한 경우)
  - 외부 의존성(DB, S3, bcrypt, reverse geocoding 등)은 전부 mock
- 장점
  - 실패 케이스(rollback/release/cleanup 호출 여부 등)를 세밀하게 커버 가능
  - 실행 속도가 빠르고, CI에서 안정적
- 현재 구현된 유닛 테스트 예
  - `backend/tests/unit/controllers/postController.transaction.test.js`
    - `uploadImage`: 트랜잭션 + S3 cleanup 호출 흐름
    - `deletePost`: commit/rollback/release 흐름

#### 2.2 Integration Test (실제 연동 검증)
- 대상
  - API 요청 레벨(라우터/컨트롤러)에서
    - DB에 정상 반영되는지
    - S3에 실제 객체가 업로드/삭제되는지
    - 인증/권한/익명 처리 흐름이 올바른지
  - 가능하면 “실패 시나리오”도 일부 검증(단, 주입(injection) 전략이 필요)
- 장점
  - mock이 아닌 실제 동작을 보장
- 단점
  - 세팅이 필요(테스트용 DB, S3 환경, 앱 부팅 등)
  - 실행 시간이 늘 수 있음

### 3) 폴더 구조(권장)
현재 jest는 기본 패턴(`*.test.js`)을 사용하므로, 파일명 규칙만 맞추면 별도 설정 없이도 동작한다는 전제를 둔다.

```
backend/
  tests/
    unit/
      controllers/
      services/
    integration/
      controllers/
      routes/
    utils/
      createMockConnection.js
      makeReqResNext.js
      testApp.js
    fixtures/
      sampleImage.jpg
```

#### 파일 네이밍 규칙(권장)
- 유닛: `*.test.js`
- 통합: `*.int.test.js` (또는 `*.integration.test.js`)
- 이렇게 하면 추후 Jest 스크립트를 분리할 때 편하다.

### 4) 공통 테스트 도구/유틸

#### 4.1 Unit 테스트 공통 유틸
- `tests/utils/createMockConnection.js`
  - `beginTransaction`, `commit`, `rollback`, `release`를 jest.fn()으로 제공
  - 성공/실패 설정을 케이스별로 주입 가능
- `tests/utils/makeReqResNext.js`
  - `req`, `res.status().send()`, `next()` mock 헬퍼 제공

#### 4.2 Integration 테스트 공통 유틸
- `tests/utils/testApp.js`
  - `src/server.js` 또는 `src/app.js`를 분리해 테스트에서 앱을 재사용
  - 현재 구조가 `server.js` 단일 파일이면, 통합 테스트를 위해 앱 인스턴스를 export하는 형태로 리팩토링할 수 있다.
- `tests/utils/testDB.js`
  - 테스트용 DB 초기화/마이그레이션/스키마 보장
  - 테스트마다 테이블 정리(truncate) 또는 트랜잭션 롤백 전략을 선택

### 5) Unit Test 구현 가이드(현재 문서의 범위)

#### 5.1 mock 대상
- DB
  - `db.pool.getConnection()`
  - `connection.beginTransaction() / commit() / rollback() / release()`
  - `db.*` 함수들: `fetchPostById`, `insertPostToDb`, `deletePictureById` 등
- S3
  - `s3Service.uploadToCloud`, `s3Service.deleteFromCloud` mock
  - cleanup 실패/성공 모두 케이스로 만들기
- S3 업로드 키 전달
  - `uploadImage`에서 `processImageUpload`가 반환하는 `{ pictureKey, pictureId }`를 상위에서 저장하고,
  - DB 실패 시 `pictureKey`가 있을 때만 cleanup을 호출하도록 테스트한다.

#### 5.2 트랜잭션 관련 최소 보장 항목(추천)
- 성공 경로
  - `beginTransaction` 호출
  - `commit` 호출
  - `rollback` 미호출
  - `release` 호출
- 실패 경로
  - DB 단계 실패 시 `rollback` 호출 + `release` 호출 + `next(err)` 호출
- cleanup 실패
  - cleanup 실패가 원래 에러를 덮어쓰지 않는지(원래 `err` 유지) 검증

### 6) Integration Test 구현 가이드(추후)

#### 6.1 필요한 추가 패키지(가능성)
- 현재 devDependencies에 `supertest`가 없다.
- 통합 테스트에서 API를 요청하려면 보통 `supertest`를 추가한다.
- S3까지 검증하려면 로컬 환경 구성(LocalStack, 또는 전용 테스트 버킷)을 선택해야 한다.

#### 6.2 테스트 DB 세팅
- 현재 jest test 스크립트가 `DB_NAME=strayspotter_database_test`로 실행한다.
- 따라서 통합 테스트에서도 동일한 테스트 DB를 사용한다.
- DB 초기화는 다음 중 하나로 한다.
  - `init.sql`을 테스트 시작 전에 실행(권장)
  - 또는 migration/seed 스크립트를 별도 제공

#### 6.3 테스트 S3 세팅
- 옵션 A: LocalStack(권장)
  - 실제 네트워크/권한 없이 S3 API 동작만 재현
- 옵션 B: AWS 테스트 버킷(대안)
  - `gallery/` prefix 아래에 업로드하고,
  - 테스트 종료 후 cleanup(업로드된 키/prefix 삭제)
  - 실패 시 orphan 객체가 남을 수 있어 “재시도/정리 잡”이 필요할 수 있다.

#### 6.4 통합 테스트 케이스(예시)
- `POST /upload`(혹은 실제 업로드 라우트)
  - 정상 업로드: DB row 생성 + S3 object 존재 확인
  - 실패 업로드(주입 필요): 실패 시 DB 변경이 없거나/cleanup이 수행되는지 확인
- `DELETE /posts/:id`
  - 로그인 사용자 소유글: 삭제 성공(커밋) + S3 object 삭제 확인(해당 구현이 있다면)
  - 권한 없음: 403 + DB 변화 없음
  - 익명 글: 비번 일치/불일치에 따른 결과 확인

#### 6.5 실패 주입(injection) 전략(중요)
- 통합 테스트에서 “S3 성공 후 DB 실패” 같은 시나리오를 재현하려면,
  - 테스트용 환경변수로 특정 함수만 throw하도록 훅을 넣는 방법이 가장 현실적이다.
  - 예: `process.env.TEST_FAILPOINT === 'insertPostToDb'`일 때 해당 함수에서 강제로 throw
- 이 전략은 “프로덕션 코드에 테스트 훅이 남는 것”을 싫어할 수 있으므로,
  - 최소한의 범위로 구현하거나,
  - 또는 테스트 전용 모듈/DI(의존성 주입)로 대체하는 방식을 검토한다.

### 7) 실행/분리 전략(권장)

#### 7.1 단위 테스트
- 기본 `npm test`는 유닛 테스트로만 유지할 수 있다.
- 통합 테스트 파일은 `*.int.test.js` 같은 규칙으로만 만들고,
  - Jest에서 `--testPathPattern`으로 통합만 골라 실행하는 스크립트를 추후 추가하는 것을 권장한다.

#### 7.2 통합 테스트
- 별도 스크립트 예시(구현은 추후)
  - `npm run test:int`
  - `jest --testPathPattern=tests/integration`

### 8) 현재 상태 요약
- 이미 구현된 유닛 테스트:
  - `backend/tests/unit/controllers/postController.transaction.test.js`
- 다음 단계:
  - 통합 테스트 폴더/유틸/실패 주입 전략을 확정한 뒤 `tests/integration` 케이스 확장

