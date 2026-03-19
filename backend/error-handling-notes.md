## 에러 처리 정리

### 1. 기존 문제점

- **컨트롤러별 개별 에러 응답**
  - `postController`, `pictureController`, `userController`, `imageController` 등에서
    `res.status(...).send/json(...)`로 에러 응답을 직접 작성.
  - 어떤 곳은 `CustomError`를 체크하고, 어떤 곳은 바로 500을 내려서
    응답 포맷과 처리 방식이 일관되지 않음.

- **글로벌 에러 핸들러 활용 부족**
  - `errorHandler` 미들웨어는 있지만,
    컨트롤러에서 이미 에러 응답을 보내는 경우가 많아
    모든 에러가 글로벌 핸들러를 거치지 않음.

- **예상된 에러 vs 예상치 못한 에러 구분 불명확**
  - 유효성 검증 실패(400), 리소스 없음(404), 권한 없음(401/403) 같은
    예상 가능한 비즈니스 에러와 DB 장애, 코드 버그, 외부 서버 장애 같은
    진짜 서버 에러(500)가 섞여서 처리되고 있었음.

---

### 2. 목표/설계 방향

- **에러 생성과 에러 응답을 분리**
  - 컨트롤러:
    - 성공 시에만 `res.status(...).json/send(...)` 호출.
    - 에러는 항상 `throw` 또는 `next(err)`로 **전파만** 담당.
  - 글로벌 에러 핸들러:
    - 모든 에러를 한 곳에서 받아서
      상태 코드, 메시지, 노출 여부, 로깅 정책을 일괄 처리.

- **예상된 에러는 CustomError 계층으로 표현**
  - `backend/errors/CustomError.js`:
    - `CustomError`(기본), `ValidationError(400)`, `NotFoundError(404)`,
      `ForbiddenError(403)`, `UnauthorizedError(401)`, `PayloadTooLargeError(413)` 등.
  - 여러 곳에서 반복되는 패턴(유효성 검증 실패, 리소스 없음, 권한 없음 등)은
    `extends CustomError`로 클래스를 만들어 재사용.

- **예상치 못한 에러는 500 + 일반 메시지 처리**
  - 코드 버그, DB 장애, 외부 서비스 장애 등은
    별도 커스텀 클래스 없이 그대로 throw → 글로벌 핸들러에서 500 처리.

---

### 3. CustomError와 expose 플래그

- `CustomError` 생성자:

  ```js
  class CustomError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.expose = statusCode >= 400 && statusCode < 500;
    }
  }
  ```

  - 4xx(클라이언트 잘못) → `expose = true` (메시지 노출 허용)
  - 5xx(서버 문제) → `expose = false` (메시지 숨김, 내부용)

- 이 규칙으로 각 에러가 “사용자에게 메시지를 보여줘도 되는지”를
  기본값으로 지정해 둠.

---

### 4. 글로벌 에러 핸들러 로직 (`backend/src/middleware/errorHandler.js`)

- 핵심 부분:

  ```js
  const statusCode = err.statusCode || err.status || 500;
  const expose =
    typeof err.expose === 'boolean'
      ? err.expose
      : statusCode >= 400 && statusCode < 500;

  const message = expose && err.message ? err.message : 'Internal Server Error';

  res.status(statusCode).json({ message });
  ```

- 동작 방식:
  - 에러 객체에 `expose`가 명시적으로 설정돼 있으면 그 값을 그대로 사용.
  - 없으면 `statusCode` 기준으로 4xx → `true`, 그 외 → `false`.
  - `expose === true`이면 실제 에러 메시지를 클라이언트에 보내고,
    아니면 `"Internal Server Error"`로 통일.

- 효과:
  - **4xx(사용자 잘못)** → 구체적인 메시지 제공.
  - **5xx(서버 문제)** → 내부 정보 노출 없이 일반 메시지만 제공.

---

### 5. 컨트롤러 쪽 공통 패턴

- 기본 패턴:

  ```js
  async function controller(req, res, next) {
    try {
      // 1) 유효성 검증 실패 → ValidationError 등으로 throw
      // 2) 리소스 없음, 권한 없음 등 → NotFoundError, ForbiddenError 등으로 throw
      // 3) 나머지 예기치 못한 에러 → 그냥 throw (catch에서 next)

      res.status(200).json(...); // 성공 응답
    } catch (err) {
      next(err); // 글로벌 에러 핸들러로 위임
    }
  }
  ```

- 컨트롤러는 가능한 한:
  - **성공 응답만 직접 작성**하고,
  - 에러는 모두 예외로 던져서 글로벌 핸들러가 처리하도록 통일.

---

### 6. 어떤 에러를 확장 클래스로 만들지 vs 그냥 CustomError로 쓸지

- **확장 클래스(`extends CustomError`)로 만드는 경우**
  - 여러 곳에서 반복되는 공통 의미가 있는 에러일 때.
    - 예: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `PayloadTooLargeError`.
  - 타입(`instanceof`)으로 분기하거나, 해당 타입만 따로 처리하고 싶을 때.

- **그때그때 `new CustomError(...)`로 만드는 경우**
  - 특정 엔드포인트/로직 안에서만 의미 있는 1회성 에러일 때.
    - 예: `"Failed to delete picture"`, `"Failed to delete post"` 등.
  - 별도 타입 분기/재사용이 필요 없을 때.

---

### 7. 예상하지 못한 에러(버그 등)의 흐름

- 현재 구조:
  - 각 async 컨트롤러가 `try { ... } catch (err) { next(err); }` 패턴을 사용.
  - `try` 블록 안에서 발생한 모든 예외(예상/비예상 포함)는
    `catch`에서 `next(err)`를 통해 글로벌 에러 핸들러로 전달됨.

- 주의할 점:
  - `try` 블록 바깥에서 바로 `throw` 하는 경우,
  - `setTimeout`, 콜백 등 비동기 함수 안에서 `throw` 하고
    `await`/`try`로 묶지 않은 경우,
  - (Express 4 기준) `async (req, res) => { throw new Error(); }` 처럼
    `try/catch` 없이 사용하는 경우
  - 위와 같은 상황에서는 `next`를 타지 못할 수 있어,
    현재처럼 `try/catch + next(err)` 패턴을 유지하는 것이 안전함.

---

### 8. 이 구조의 장점 요약

- **응답/메시지 포맷 일관성**
  - 모든 에러 응답 형식을 글로벌 핸들러에서 통일.

- **로깅·모니터링·알림의 중앙 집중화**
  - 에러 로깅, 모니터링, 알림 연동을 한 곳에만 추가하면 됨.

- **보안**
  - 내부 에러 메시지/스택을 프론트에 노출하지 않고,
    노출해도 되는 메시지(`expose === true`)만 노출.

- **유지보수와 정책 변경 용이**
  - 에러 처리 정책(메시지 포맷, 노출 여부, 추가 필드 등)을
    하나의 미들웨어에서만 수정하면 전체 적용 가능.

