# Contributing Guidelines

Thank you for considering contributing to this project! Please follow the conventions and rules below to ensure consistent and maintainable code.

---

## 🚀 Commit Convention

Use the following format for all commit messages:
<type>: <subject>

### Commit Types

- **feat**: Add a new feature  
- **fix**: Fix a bug  
- **docs**: Update documentation  
- **style**: Code formatting (e.g., semicolons, spacing), no logic changes  
- **refactor**: Refactor code without changing behavior  
- **test**: Add or refactor test code  
- **chore**: Update build tasks or package configurations  

**Example:**
git commit -m "feat: Add login API"

## 🌿 Branching Strategy
We follow the **Git Flow** model:

- `main`: Production-ready code  
- `development`: Integration branch for features  
- `feature/<feature-name>`: Feature development branch  
- `hotfix/<issue-name>`: Urgent fixes  
- `refactor/<topic>`: Large-scale refactoring (e.g. structure change, logic reorganization)

**Example:**
git checkout -b feature/user-auth

---

## 🧑‍💻 Code Style Conventions

### JavaScript

- Always use **semicolons (`;`)**
- Always use **curly braces (`{}`)**, even for single-line conditions
- Use **camelCase** for variables and functions

### Python & Database

- Use **snake_case** for variables and DB field/table names

---

## ✅ Pull Request Guidelines

- Use a commit-style title for your PR
- Keep PRs small and focused
- Provide clear explanations in the PR description
- Ensure your code is tested and linted

---

Thanks for your contribution! 🙌  
Let’s keep the code clean and collaboration smooth.