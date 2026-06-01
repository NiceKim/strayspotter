# GitHub Actions 배포 가이드 (SSM + OIDC, 실행 순서 기준)

이 문서는 **중복 없이 한 번에 따라갈 수 있는 운영 배포 가이드**입니다.

목표:

- GitHub Actions에서 `backend`, `frontend` 이미지를 GHCR로 빌드/푸시
- EC2는 빌드하지 않고 `pull + up -d`만 수행
- 운영 배포는 `Production` Environment 승인 후 실행
- SSH 없이 AWS SSM으로 배포 명령 실행

---

## 0) 전체 흐름 먼저 이해하기

1. `main` 브랜치에 코드 푸시
2. Actions `build-and-push` job이 GHCR 이미지 업데이트
3. `deploy-ec2` job이 `Production` 승인 대기
4. 승인 후 OIDC로 AWS Role Assume
5. SSM으로 EC2에 `npm run deploy` 실행
6. EC2에서 `docker compose pull && docker compose up -d` 반영

이 구조를 쓰는 이유:

- EC2 메모리 부족으로 인한 빌드 실패 방지
- 배포 기록/실패 원인을 CI 로그에서 추적 가능
- 운영 승인 절차를 강제할 수 있음

---

## 1) 사전 체크 (5분)

EC2에서 아래 명령을 먼저 확인합니다.

```bash
cd ~/strayspotter
docker --version
docker compose version
docker compose config
```

필수 조건:

- 프로젝트 경로가 `~/strayspotter`에 있음
- `docker compose` 명령이 정상 동작
- 운영용 `docker-compose.yml`이 `build:`가 아닌 `image:` 기반
- 배포 기준 브랜치는 `main` (다르면 아래 워크플로우 브랜치 수정)

---

## 2) 운영 compose 파일 고정

운영 배포는 이미지를 pull하는 방식이어야 합니다.

예시(개념):

- `app`: `image: ghcr.io/<owner>/strayspotter-app:latest`
- `frontend`: `image: ghcr.io/<owner>/strayspotter-frontend:latest`

핵심 포인트:

- EC2에서 Dockerfile 빌드를 하지 않도록 구성
- `npm run deploy` 스크립트가 내부적으로 `docker compose pull && docker compose up -d`를 수행하도록 유지

---

## 3) GitHub Environment 생성 (Production)

경로: `Repository -> Settings -> Environments -> New environment`

1. 이름을 `Production`으로 생성
2. `Required reviewers` 최소 1명 설정
3. (권장) `Deployment branches`를 `main`으로 제한
4. (선택) `Wait timer` 1~5분 설정

왜 필요한가:

- 실수로 푸시 즉시 운영 반영되는 것을 방지
- 승인 절차를 배포 파이프라인에 강제

---

## 4) AWS 권한 준비 (SSM + OIDC)

### 4-1) EC2에 SSM 권한 부여

1. `EC2 -> Instances`에서 대상 인스턴스 선택
2. `Actions -> Security -> Modify IAM role`
3. 연결된 IAM Role에 `AmazonSSMManagedInstanceCore` 정책 추가
4. 저장 후 1~2분 대기

### 4-2) OIDC Provider 생성

1. `IAM -> Identity providers -> Add provider`
2. Provider type: `OpenID Connect`
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`

### 4-3) 배포용 IAM Policy 먼저 생성

1. `IAM -> Policies -> Create policy`
2. `JSON` 탭 선택
3. 아래 policy 붙여넣고 생성 (이름 예시: `GitHubActionsSsmDeployPolicy`)

권장 policy(JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4-4) GitHub Actions용 IAM Role 생성

1. `IAM -> Roles -> Create role -> Web identity`
2. 방금 만든 OIDC provider 선택
3. Role 이름 예시: `GitHubActionsDeployRole`
4. Permissions policy 선택 화면에서 **4-3에서 만든 policy**를 검색해 선택


```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/<REPO>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```


### 4-5) SSM Online 확인

```bash
aws ssm describe-instance-information --region <AWS_REGION>
```

- 대상 인스턴스가 목록에 보이고 상태가 `Online`

---

## 5) Production Environment secrets 등록

경로: `Repository -> Settings -> Environments -> Production -> Environment secrets`

필수:

- `AWS_REGION` (예: `ap-southeast-1`)
- `AWS_ROLE_TO_ASSUME` (4-4에서 만든 IAM Role ARN)
- `EC2_INSTANCE_ID` (예: `i-0123456789abcdef0`)

private GHCR 사용 시 추가:

- `GHCR_USERNAME`
- `GHCR_TOKEN` (`read:packages` 권한)

주의:

- 운영 값은 Repository secrets보다 Environment secrets를 권장
- Deploy job에 반드시 `environment: Production`을 명시해야 이 시크릿을 읽음

---

## 6) 워크플로우 파일 작성

파일: `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/strayspotter-app:latest
            ghcr.io/${{ github.repository_owner }}/strayspotter-app:${{ github.sha }}

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/strayspotter-frontend:latest
            ghcr.io/${{ github.repository_owner }}/strayspotter-frontend:${{ github.sha }}

  deploy-ec2:
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: Production
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Deploy via SSM Run Command
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --comment "Deploy strayspotter" \
            --parameters commands='[
              "set -e",
              "cd ~/strayspotter",
              "npm run deploy"
            ]' \
            --query "Command.CommandId" \
            --output text)

          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "${{ secrets.EC2_INSTANCE_ID }}"

          aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "${{ secrets.EC2_INSTANCE_ID }}" \
            --query '{Status:Status,StdOut:StandardOutputContent,StdErr:StandardErrorContent}'
```

---

## 7) private GHCR일 때 추가할 것

`deploy-ec2`의 SSM commands 배열에서 `npm run deploy` 전에 아래 한 줄을 추가:

```bash
echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u "${{ secrets.GHCR_USERNAME }}" --password-stdin
```

이유:

- private 패키지는 EC2에서 인증 없이 pull할 수 없음

---

## 8) 첫 배포 실행

1. `deploy.yml`을 `main`에 반영
2. GitHub `Actions` 탭에서 워크플로우 실행 확인
3. `build-and-push` 성공 확인
4. `deploy-ec2`가 `Production` 승인 대기인지 확인
5. `Review deployments`에서 승인
6. `deploy-ec2` 성공 확인
7. EC2에서 상태 확인

```bash
cd ~/strayspotter
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 frontend
```

---

## 9) 실패 시 확인 순서

### 9-1) Build 단계 실패 (`build-and-push`)

- Dockerfile 오류
- 빌드 컨텍스트 경로 오류 (`./backend`, `./frontend`)
- `packages: write` 권한 누락

### 9-2) Deploy 단계 실패 (`deploy-ec2`)

- `AWS_ROLE_TO_ASSUME` 값 오류
- OIDC trust policy의 `<OWNER>/<REPO>` 또는 브랜치 조건 불일치
- `EC2_INSTANCE_ID` 오타
- SSM `Online` 상태 아님
- private GHCR인데 로그인 줄 누락

### 9-3) 배포는 성공인데 앱 접속 불가

- `docker compose ps`
- `docker compose logs -f app`
- `docker compose logs -f frontend`
- 포트 매핑 / Nginx 설정 확인

---

## 10) 운영 안정화 체크리스트

- `latest`만 쓰지 말고 `${{ github.sha }}` 태그도 함께 관리
- 롤백용 이전 SHA 이미지 보존
- 무분별한 전체 prune 지양 (`docker image prune -f`는 목적성 있게 실행)
- `Production` 승인자 최소 1명 이상 유지