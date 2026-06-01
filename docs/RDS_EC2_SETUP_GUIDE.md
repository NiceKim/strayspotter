# EC2 - RDS 연결 실전 가이드 (Free Tier 기준, Docker Compose + `.env`)

## 흐름 요약

1. **네트워크**: VPC → Public/Private 서브넷 → Internet Gateway·라우팅 (NAT 없이 EC2만 공인 IP로 외부 접근)
2. **보안 그룹**: EC2용·RDS용 SG 생성 → RDS `3306`은 EC2 SG에서만 허용
3. **리소스**: EC2는 Public 서브넷, RDS는 Private 서브넷 + `Public access = No`
4. **배포·검증**: EC2에 코드 반영 → `.env`에 RDS endpoint → `docker compose up` → `nc`/헬스·API로 확인

이 문서는 **AWS Free Tier를 최대한 벗어나지 않는 구성**을 기준으로, 네트워크 생성부터 EC2 앱 배포까지 순서대로 진행하는 가이드입니다.

---

## 1) 이번 구성 원칙 (Free Tier 우선)

- EC2: 1대만 사용
- EC2는 Public subnet 배치 (운영 단순화)
- RDS는 Private subnet 배치 + `Public access = No`
- NAT Gateway 생성하지 않음 (비용 발생)
- RDS는 `Single-AZ`로 시작
- 보안은 SG 참조 방식으로 제한 (`sg-app-ec2 -> sg-rds:3306`)

---

## 2) 시작 전 체크 (비용/리전/가용영역)

1. AWS 리전 고정 (예: `ap-southeast-1`)
2. EC2/RDS 생성 화면에서 `Free tier eligible` 배지 확인
3. 예상 비용(Estimated monthly cost) 표시 확인
4. 실습용 태그 통일 (예: `Project=strayspotter`)

> Free Tier 조건은 계정 생성 시점/리전/정책에 따라 달라질 수 있습니다. 콘솔의 Free tier 표시를 최종 기준으로 삼으세요.

---

## 3) 네트워크 대역 설계 (왜 이렇게 잡는지)

이번 가이드 대역:

- VPC CIDR: `10.0.0.0/16`
- Public subnet (EC2): `10.0.1.0/24` (`ap-southeast-1a`)
- Private DB subnet A (RDS): `10.0.21.0/24` (`ap-southeast-1a`)
- Private DB subnet B (RDS, 다른 AZ): `10.0.22.0/24` (`ap-southeast-1b`)

이유:

- `10.0.0.0/16`: 앞으로 서브넷을 더 늘릴 수 있는 여유가 큼
- `/24`: 관리가 쉽고 역할별 분리가 명확
- `10.0.1.x` / `10.0.21.x` / `10.0.22.x`: public·DB 구분과 AZ별 DB 서브넷 구분이 쉬움

---

## 4) VPC 생성

1. `VPC` 서비스 이동
2. `Your VPCs -> Create VPC`
3. `VPC only` 선택
4. Name: `strayspotter-vpc`
5. IPv4 CIDR: `10.0.0.0/16`
6. 생성 후 `Actions -> Edit VPC settings`
  - `Enable DNS hostnames` 활성화 : IP 대신 이름으로 접근 가능하게 설정
  - `Enable DNS resolution` 활성화

---

## 5) Subnet 생성 (Public 1개 + Private DB 2개)

EC2는 인스턴스 생성 시 **서브넷을 직접 고르지만**, RDS는 서브넷 한 칸을 고르는 UI가 없고 **`DB subnet group`(서브넷 묶음)** 만 선택합니다. RDS가 장애 조치·재배치·Multi-AZ 등에 쓸 **서브넷 풀**을 미리 정해두는 모델이기 때문입니다. 그래서 콘솔에서는 **서브넷 → DB subnet group → RDS** 순서로 잡습니다.

1. `Subnets -> Create subnet`
2. VPC: `strayspotter-vpc` 선택
3. 아래 **3개** 생성 (리전 AZ 이름은 본인 리전에 맞게 선택)
  - `public-subnet-a` / `ap-southeast-1a` / `10.0.1.0/24`
  - `private-db-subnet-a` / `ap-southeast-1a` / `10.0.21.0/24`
  - `private-db-subnet-b` / `ap-southeast-1b` / `10.0.22.0/24`
4. `public-subnet-a` 선택 -> `Actions -> Edit subnet settings`
5. `Enable auto-assign public IPv4 address` 활성화

### 5-1) DB Subnet Group 생성

서브넷이 준비된 뒤, RDS가 참조할 그룹을 만듭니다.

1. `RDS` 서비스 -> 왼쪽 `Subnet groups` (또는 생성 마법사 안의 `Create new DB subnet group`)
2. `Create DB subnet group`
3. Name: 예) `strayspotter-db-subnet-group`
4. VPC: `strayspotter-vpc`
5. `Availability Zones`에 **`ap-southeast-1a`, `ap-southeast-1b`** 선택 (위에서 쓴 AZ와 동일하게)
6. `Subnets`에서 **`10.0.21.0/24`**, **`10.0.22.0/24`** 에 해당하는 서브넷 선택 (`private-db-subnet-a`, `private-db-subnet-b`)
7. 생성

> 서브넷 CIDR는 VPC 안에서 서로 겹치면 안 됩니다. 같은 역할이어도 AZ가 다르면 **대역을 나눠** 두는 편이 안전합니다(예: `10.0.21.0/24`, `10.0.22.0/24`).

---

## 6) Internet Gateway + Route Table 설정

### 6-1. Internet Gateway

1. `Internet gateways -> Create internet gateway`
2. Name: `strayspotter-igw`
3. 생성 후 `Actions -> Attach to VPC` -> `strayspotter-vpc`

### 6-2. Public Route Table

1. `Route tables -> Create route table`
2. Name: `rt-public`, VPC: `strayspotter-vpc`
3. `Routes -> Edit routes -> Add route`
  - Destination: `0.0.0.0/0`
  - Target: `Internet Gateway -> strayspotter-igw`
4. `Subnet associations`에서 `public-subnet-a` 연결

### 6-3. Private DB Route Table

1. `Create route table`
2. Name: `rt-private-db`, VPC: `strayspotter-vpc`
3. `Subnet associations`에서 `private-db-subnet-a`, `private-db-subnet-b` 연결
4. `Routes`는 local route만 유지 (NAT 없음 구성이면 `0.0.0.0/0` 추가하지 않음)

---

## 7) Security Group 생성

### 7-1. 앱용 SG (`sg-app-ec2`)

1. `Security Groups -> Create security group`
2. Name: `sg-app-ec2`, VPC: `strayspotter-vpc`
3. Inbound
  - `80` (HTTP): 필요한 소스만 (기본은 모두 허용, CloudFlare 사용 시 IP 지정)
  - `443` (HTTPS): 필요한 소스만 (기본은 모두 허용, CloudFlare 사용 시 IP 지정)
  - SSH 사용 시 `22`: 내 IP만 허용
4. Outbound: 기본 허용

### 7-2. DB용 SG (`sg-rds`)

1. `Create security group`
2. Name: `sg-rds`, VPC: `strayspotter-vpc`
3. Inbound
  - Type: `MySQL/Aurora`
  - Port: `3306`
  - Source: `sg-app-ec2`

> `0.0.0.0/0` 로 DB 포트 오픈 금지

---

## 8) EC2 인스턴스 생성 (Public Subnet)

1. `EC2 -> Instances -> Launch instances`
2. AMI/인스턴스 타입에서 Free Tier 대상 선택
3. Network settings
  - VPC: `strayspotter-vpc`
  - Subnet: `public-subnet-a`
  - Auto-assign public IP: `Enable`
4. Security Group: `sg-app-ec2`
5. 스토리지는 최소로 시작
6. (권장) IAM Role에 `AmazonSSMManagedInstanceCore` 연결

---

## 9) RDS 생성 (Private Subnet, DB Subnet Group 사용)

1. `RDS -> Databases -> Create database`
2. 엔진 선택 (예: MySQL)
3. 생성 마법사에서 Free Tier eligible 확인
4. `Single-AZ`로 설정 (실제 인스턴스는 그룹 안의 **한 AZ·한 서브넷**에 올라감)
5. `Connectivity`에서
  - VPC: `strayspotter-vpc`
  - **DB subnet group**: 미리 만든 `strayspotter-db-subnet-group` 선택 (개별 서브넷 이름은 여기서 고르지 않음)
  - Public access: `No`
  - VPC security group: `sg-rds`
6. 생성 완료 후 RDS endpoint 복사

참고: RDS 콘솔은 EC2처럼 “이 서브넷에 올려줘”를 직접 고르게 하지 않고, **DB subnet group이 허용한 서브넷들 중**에서 AWS가 배치합니다. `Single-AZ`면 그중 한 AZ·한 서브넷만 사용합니다.

---

## 10) EC2에 프로젝트 배포 (빈 인스턴스 기준)

EC2를 새로 만들었다면 Docker/Git이 없는 경우가 많습니다. 먼저 기본 패키지를 설치합니다.

### 10-1) 기본 도구 설치

먼저 어떤 패키지 매니저가 있는지 확인:

```bash
cat /etc/os-release
command -v apt || command -v dnf || command -v yum
```

#### Ubuntu 계열

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git netcat-openbsd mysql-client
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

#### Amazon Linux 2023 계열

```bash
sudo dnf update -y
sudo dnf install -y docker git nc mysql
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
```

#### Amazon Linux 2 계열 (`apt` 없음, `dnf` 없음)

```bash
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo yum install -y git nc mysql
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
```

설치 확인:

```bash
docker --version
docker compose version
git --version
```

### 10-2) 프로젝트 코드 가져오기

```bash
git clone <your-repo-url>
cd strayspotter
```

### 10-3) 루트 `.env` 수정

```dotenv
DB_HOST=<your-rds-endpoint>
DB_PORT=3306
DB_NAME=<your-db-name>
DB_PASSWORD=<your-db-password>
APP_HOST=0.0.0.0
APP_PORT=3000
NODE_ENV=production
```

### 10-4) `.env` 권한 제한

```bash
chmod 600 .env
```

---

## 11) 연결 점검 후 실행

RDS 포트 점검:

```bash
nc -zv <your-rds-endpoint> 3306
```

앱 실행:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

---

## 12) DB 초기화 및 최종 확인

최초 1회:

```bash
mysql -h <your-rds-endpoint> -P 3306 -u <db-user> -p <db-name> < backend/init.sql
```

검증:

- `http://<EC2_PUBLIC_IP>/health` 확인
- 주요 API 호출 테스트
- RDS 모니터링에서 에러/커넥션 확인

---

## 13) 문제 발생 시 빠른 점검

- EC2와 RDS의 `VPC ID`가 같은지
- RDS 생성 시 선택한 **DB subnet group**에 기대한 private 서브넷(서로 다른 AZ)이 들어 있는지
- `sg-rds` 인바운드 소스가 `sg-app-ec2`인지
- RDS `Public access`가 `No`인지
- `.env`의 `DB_HOST`가 RDS endpoint인지
- DB 계정/비밀번호/DB명 오타 없는지

---

## 14) GitHub Actions 기반 배포는 별도 문서 참고

아래 문서로 분리했습니다.

- `GITHUB_ACTIONS_DEPLOY_GUIDE.md`

이 문서에는 다음이 포함됩니다.

- CI 빌드 후 EC2 `pull` 배포 흐름
- GitHub `Secrets`와 `Environments` 상세 설정
- `.github/workflows/deploy.yml` 예시
- 배포 단계별 명령 의미/이유