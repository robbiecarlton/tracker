# 1. One Expo codebase for iOS and web

Date: 2026-09-10
Status: accepted

## Context

The app needs a web frontend and an iOS app. We want to minimise duplicated UI
work without shipping something that feels like a wrapped website, because a
public App Store release is a near-term goal.

Options considered:

1. **Expo (React Native) + React Native Web** — one UI codebase for both.
2. **Separate React web + SwiftUI iOS**, sharing only a domain-logic package.
3. **Capacitor** — build the web app, wrap it in a native shell.

## Decision

Option 1. A single Expo Router app renders both iOS and web. Shared domain logic
lives in `@tracker/core`. The habit-tracker UI (dashboard cards, log buttons, a
few forms, a log list) is simple enough that React Native Web holds up well.

## Consequences

- One UI to build and maintain; native iOS app for the App Store.
- Minor styling divergence between web and native to manage.
- Some web niceties (SEO, deep desktop layouts) are weaker than a bespoke React
  web app would give; acceptable for this product.
- Native iOS builds and submission handled later via EAS.
