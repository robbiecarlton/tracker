# Changelog

All notable changes to `@tracker/core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-10

### Added

- Package skeleton: `Unit` enum + guard, domain model type stubs (`Habit`,
  `HabitView`, `HabitLog`, `ViewKind`, `TargetType`), and shared Zod auth
  schemas (`signUpSchema`, `signInSchema`).
- No view calculations yet — those arrive in Phase 2 (see `docs/DOMAIN.md`).
