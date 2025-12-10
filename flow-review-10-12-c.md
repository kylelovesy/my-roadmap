# Flow Review 10-12 — (c) Register Flow

## Scope
- `RegisterScreen`, `useRegister`, `AuthService.register`, `FirestoreAuthRepository.register`, post-sign-up auth initialization.

## Current Flow
- `RegisterScreen` submits to `useRegister`, shows a progress bar while loading, and on success attempts to route to Pricing.
- `useRegister` sets both local and global auth `LoadingState`, calls `authService.register`, waits for user docs, fetches the user, and writes success to the auth store.
- `AuthInitializer` listens for the Firebase auth user and fetches/subscribes to the Firestore user document.

## Findings
- **Critical – Hook rule violation:** `useUser()` (a selector hook) is called inside the `handleRegister` callback after the async call, which breaks the Rules of Hooks and can crash in runtime/DevTools.

```67:77:src/app/(auth)/register.tsx
const handleRegister = useCallback(
  async (data: RegisterInput): Promise<boolean> => {
    const success = await register(data);

    // Route unverified users to the verification screen right after a successful sign-up
    if (success) {
      // UPDATED: Use selector for user
      const user = useUser();
      if (user) {
        router.replace(NavigationRoute.PRICING);
      }
    }
    return success;
  },
```

- **Major – Initialization flag unused:** `const isInitializing = useIsInitializing();` is declared but omitted from `loading`, so the screen can allow interactions/navigations while auth is still initializing, reintroducing race conditions the comment warns about.

```52:88:src/app/(auth)/register.tsx
const isInitializing = useIsInitializing();
...
return (
  <Screen
    // loading={isLoading || isInitializing}
    loading={isLoading}
    error={error}
    scrollable={true}
    safeArea={true}
    testID="register-screen"
  >
```

- **Minor – Progress UI not tied to real state:** The progress bar uses `stage/progress` but the messages don’t align with the stages emitted by `useRegister` and the `LoadingStateDisplay` is hardcoded to `INIT_LOADING`, so users see placeholder progress that may not reflect real stages.

```95:104:src/app/(auth)/register.tsx
{isLoading && stage && (
  <>
    <ProgressBar progress={progress ?? 0} ... />
    <StandardSpacer size="md" />
    <LoadingStateDisplay state={INIT_LOADING<User | null>()} children={() => <></>} />
    ...
  </>
)}
```

## Recommendations
- Move `useUser()` outside the callback (or use the imperative `getUser()`) so hooks stay at the top level and the callback reads already-selected user data.
- Include `isInitializing` in the `Screen` loading calculation to block navigation while auth initialization is in-flight, matching the sign-in behavior.
- Bind the progress UI to the actual `state` from `useRegister` (or use `LoadingStateDisplay` with the hook state) and align stage strings with the UI copy.
- Add tests: hook rule compliance lint, loading flag behavior (includes initialization), and progress rendering across stages.

## Mermaid Diagram
```mermaid
flowchart TD
  A[RegisterScreen submit] --> B[useRegister hook]
  B --> C[authService.register]
  C --> D[FirestoreAuthRepository.register -> Firebase Auth + waitForUserDocumentsReady]
  D --> E[userService.getUser]
  E --> F[authState success + setIsRegistering(false)]
  F --> G[AuthInitializer subscription keeps user in sync]
  G --> H[Redirect to Pricing]
```

