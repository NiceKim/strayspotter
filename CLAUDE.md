# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Stray Spotter is a web platform for sharing photos of neighborhood cats. Users upload images; the backend extracts EXIF GPS metadata, reverse-geocodes coordinates to Singapore districts via the OneMap API, stores the image in S3, and persists metadata in MySQL. A report page visualises aggregated sightings data.

## Structure Overview

The stack is orchestrated by Docker Compose: an nginx reverse proxy sits in front of a Next.js frontend (port 3001) and a Node.js/Express backend (port 3000). The frontend never calls the backend directly — all `/api` traffic is proxied through nginx. An `ai-service` (FastAPI) exists for cat classification but is not yet integrated.

## Code Conventions

- **Commits:** `<type>: <subject>` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Branches:** `feature/<name>`, `hotfix/<name>`, `refactor/<topic>`, `chore/<topic>` off `development`; `main` is production-only
- **JS:** semicolons required, always use curly braces, camelCase for variables/functions
- **Python / DB:** snake_case for variables and column/table names

## Working Principles

These principles apply to all coding in this repo (Karpathy-inspired):

1. **Think Before Coding** — Surface assumptions and ambiguities before writing code. Ask for clarification rather than guessing.
2. **Simplicity First** — Write the minimum code that solves exactly what was asked. No speculative features, no unnecessary abstractions.
3. **Surgical Changes** — Modify only what's needed for the task. Match existing code style. Don't clean up pre-existing dead code.
4. **Goal-Driven Execution** — Define clear, verifiable success criteria before starting. Prefer concrete outcomes over vague instructions.