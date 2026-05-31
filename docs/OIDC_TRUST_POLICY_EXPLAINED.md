# GitHub Actions OIDC, IAM Role, Trust Policy 완전 정리

이 문서는 현재 `strayspotter` 배포 파이프라인에서 발생한 OIDC 인증 오류를 기준으로,
"왜 실패했는지"를 개념부터 실제 설정까지 한 번에 이해하도록 정리한 문서입니다.

---

## 1) 지금 현재 무슨 일이 일어나고 있나

배포 job(`deploy-ec2`)은 아래 흐름으로 AWS 권한을 얻습니다.

1. GitHub Actions가 OIDC 토큰 발급 요청
2. AWS STS가 해당 토큰을 검증
3. 검증되면 `AWS_ROLE_TO_ASSUME` Role을 임시로 Assume
4. 그 임시 권한으로 SSM 명령 실행 (`aws ssm send-command`)

에러:

- `Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity`

의미:

- "토큰은 받았지만, Role의 신뢰 정책(Trust Policy) 조건과 맞지 않아 Assume 거부"라는 뜻입니다.

---

## 2) OIDC가 무엇인가

OIDC(OpenID Connect)는 "외부 시스템이 발급한 신원 토큰"을 통해 로그인/권한 위임을 하는 표준입니다.

여기서는:

- 발급자: GitHub (`https://token.actions.githubusercontent.com`)
- 소비자: AWS STS
- 결과: 액세스 키를 저장하지 않고도, GitHub Actions가 AWS Role을 임시로 사용할 수 있음

즉, GitHub Secrets에 장기 AWS 키(`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`)를 저장하지 않아도 됩니다.

---

## 3) Role을 준다는 것은 무슨 뜻인가

`aws-actions/configure-aws-credentials@v4`는 내부적으로 다음을 합니다.

- "내가 이 Role을 써도 되는 주체인지"를 OIDC 토큰으로 증명
- AWS가 허용하면 해당 Role 권한을 잠깐 발급
- 이후 step에서 `aws` CLI는 그 임시 자격증명을 사용

중요:

- Role의 **Permissions Policy**는 "Assume된 뒤 무엇을 할 수 있는지"를 정의
- Role의 **Trust Policy**는 "누가 이 Role을 Assume할 수 있는지"를 정의

둘은 역할이 완전히 다릅니다.

---

## 4) Trust Policy는 무엇인가

Trust Policy는 IAM Role의 입장문입니다.

- "어떤 발급자(Federated Principal)를 신뢰할지"
- "어떤 조건의 토큰만 허용할지(`aud`, `sub` 등)"

현재 구조에서 핵심 항목:

- `Principal.Federated`:
  - `arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com`
- `Action`:
  - `sts:AssumeRoleWithWebIdentity`
- `Condition`:
  - `token.actions.githubusercontent.com:aud == sts.amazonaws.com`
  - `token.actions.githubusercontent.com:sub == (허용하려는 GitHub 컨텍스트)`

---

## 5) 이번 케이스에서 실제 문제

디버그로 확인된 실제 OIDC 클레임:

- `event=push`
- `ref=refs/heads/main`
- `repository=NiceKim/strayspotter`
- `oidc.sub=repo:NiceKim/strayspotter:environment:Production`

문제 포인트:

- 기존 Trust Policy는 `sub`를 `...:ref:refs/heads/main`으로 제한
- 실제 발급 토큰은 `...:environment:Production`
- 값이 다르니 AWS가 Assume 거부

즉 이번 오류의 본질은 **sub 불일치**입니다.

---

## 6) 왜 `environment:Production`으로 바뀌는가

`deploy.yml`의 job에 아래가 있기 때문입니다.

- `environment: Production`

GitHub는 Environment 보호 규칙(승인/제한)을 사용하는 job에 대해 OIDC `sub`를
`ref` 기반이 아니라 `environment` 기반으로 발급할 수 있습니다.

그래서 "main에 push해서 실행되더라도" `sub`가 아래처럼 나올 수 있습니다.

- `repo:NiceKim/strayspotter:environment:Production`

---

## 7) 왜 처음에는 `ref:refs/heads/main`으로 안내했나

초기 가이드가 틀린 건 아니었습니다. 일반적인 패턴은 아래 둘 중 하나입니다.

1. Environment를 쓰지 않는 배포 job
   - `sub`: `repo:<owner>/<repo>:ref:refs/heads/main`
2. Environment를 쓰는 배포 job
   - `sub`: `repo:<owner>/<repo>:environment:<EnvironmentName>`

처음 제안은 "브랜치 고정형 기본 패턴"이었고,
현재 프로젝트는 `environment: Production`을 쓰면서 실제 런타임 `sub`가 달라진 것입니다.

실무적으로는 항상 "디버그로 실제 `sub` 확인 후 Trust Policy를 맞추는 것"이 가장 안전합니다.

---

## 8) 현재 프로젝트 기준 정답 Trust Policy

아래처럼 `sub`를 Environment 기반으로 맞추는 것이 우선 정답입니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::055610219400:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:NiceKim/strayspotter:environment:Production"
        }
      }
    }
  ]
}
```

주의:

- `NiceKim`/`strayspotter`/`Production` 대소문자까지 정확히 맞추세요.
- ARN 계정(`055610219400`)과 실제 Role이 있는 계정이 동일해야 합니다.

---

## 9) Permissions Policy와의 관계

Trust Policy를 통과해도, Role 권한이 없으면 다음 단계에서 실패합니다.

배포에 필요한 최소 예시:

- `ssm:SendCommand`
- `ssm:GetCommandInvocation`
- `ssm:ListCommandInvocations`
- (선택) `ec2:DescribeInstances`

정리:

- 지금 에러는 Permissions 문제가 아니라 Trust 문제였습니다.

---

## 10) 점검 체크리스트 (재발 방지)

1. Actions 로그에서 `oidc.sub`를 먼저 확인
2. Trust Policy의 `sub`를 로그 값과 1:1 일치
3. `aud`는 `sts.amazonaws.com` 고정
4. `AWS_ROLE_TO_ASSUME`가 정확한 Role ARN인지 재확인
5. 해당 ARN의 Role에 방금 편집한 Trust Policy가 적용됐는지 확인
6. 환경이 `Production`이면 Trust도 `environment:Production`으로 관리

---

## 11) 참고: 왜 대소문자 이슈가 자주 터지나

GitHub 컨텍스트 문자열(`owner`, `repo`, `environment`)은 표시 대소문자와
실제 토큰 값이 엇갈리는 경우가 있습니다.

안전한 방법:

- 추측하지 말고 디버그로 실제 `oidc.sub`를 확인
- Trust Policy에 그 문자열 그대로 복사

---

## 12) 다음 권장 액션

1. IAM Role Trust Policy를 `environment:Production` 값으로 수정
2. 배포 재실행
3. 성공 확인 후 디버그 step은 유지 또는 제거(운영 정책에 따라 선택)

운영 안정성을 위해, 초기에는 디버그 step 유지 후 정상화되면 제거하는 방식을 권장합니다.

---

## 13) 이번 실제 장애 원인 2단계와 최종 해결

이번 배포는 "OIDC 문제 -> 서버 실행 환경 문제"가 연속으로 발생한 케이스였습니다.

### 1단계: OIDC Assume 실패

- 증상:
  - `Not authorized to perform sts:AssumeRoleWithWebIdentity`
- 원인:
  - Trust Policy의 `sub`는 `ref:refs/heads/main`이었는데
  - 실제 토큰은 `environment:Production`으로 발급
- 조치:
  - Trust Policy `sub`를 `repo:NiceKim/strayspotter:environment:Production`으로 수정

### 2단계: SSM 배포 명령 실패

- 증상:
  - `docker: 'compose' is not a docker command.`
- 원인:
  - SSH에서 동작하던 명령과 SSM Run Command 실행 컨텍스트가 달라
    `docker compose`(v2) 인식이 달랐음
- 조치:
  - 워크플로우에서 compose 커맨드를 자동 감지하도록 변경
    - 가능하면 `docker compose`
    - 아니면 `docker-compose`
    - 둘 다 없으면 명확히 실패

적용된 배포 명령 로직(요약):

```bash
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "docker compose and docker-compose are both unavailable"
  exit 1
fi

$COMPOSE_CMD pull
$COMPOSE_CMD up -d
docker image prune -f
```

### 최종 결과

- SSM 실행 결과:
  - `Status: Success`
- 컨테이너:
  - `app`, `frontend`, `nginx` 재생성 및 시작 완료
- 이미지 정리:
  - `docker image prune -f` 정상 수행(약 1.52GB 정리)

즉, 현재는 OIDC/Trust/SSM 배포 경로가 모두 정상 동작 상태입니다.
