# Flow Review 10-12 — (b) Sign-In Flow

## Scope
- `SignInScreen`, `useSignIn`, `AuthService.signIn`, `FirestoreAuthRepository.signIn`, guards and auth state handling.

## Current Flow
- `SignInScreen` submits to `useSignIn`.
- `useSignIn` sets local and global auth state to `loading`, calls `authService.signIn`.
- `authService.signIn` validates + rate-limits, then delegates to `FirestoreAuthRepository.signIn`.
- Repository signs the user in via Firebase Auth, pulls the user document, then `onAuthStateChanged` in `AuthInitializer` fetches/sets the user and guards redirect.

## Findings
- **Major – Loading never cleared on success:** `useSignIn` returns `true` without ever setting its `LoadingState` (or the store) back to `success/idle`, so the screen can remain in a loading state until unmounted.

```170:193:src/hooks/use-auth-actions.ts
const signIn = useCallback(
  async (input: SignInInput): Promise<boolean> => {
    const loadingState = loading<User | null>();
    setState(loadingState);
    setAuthState(loadingState);
    ...
    if (!result.success) { ... return false; }
    // Success - AuthInitializer will handle fetching user data
    // Keep state as loading, let AuthInitializer complete the flow
    return true;
  },
```

- **Major – Errors can’t be cleared from UI:** `SignInScreen` removed `clearError`/`onRetry`; once an error is set, the `Screen` never receives a retry handler to reset it.

```39:45:src/app/(auth)/sign-in.tsx
return (
  <Screen
    loading={isLoading}
    error={error}
    scrollable={true}
    safeArea={true}
    testID="signIn-screen"
  >
```

- **Major – Repository return type mismatch:** Interface requires `Promise<Result<void, AppError>>`, but the Firestore implementation returns `ok(user)` (a `User`), while the service is typed to `Result<void, AppError>`. This weakens type safety and can hide contract drift.

```27:33:src/repositories/i-auth-repository.ts
signIn(payload: SignInInput): Promise<Result<void, AppError>>;
```

```253:322:src/repositories/firestore/firestore-auth-repository.ts
async signIn(payload: SignInInput): Promise<Result<void, AuthError>> {
  ...
  const userResult = await this.userRepository.getById(userCredential.user.uid);
  if (userResult.success) {
    await this.userRepository.updateLastLogin(userCredential.user.uid).catch(...);
    return ok(userResult.value);
  } else {
    return err(userResult.error as AuthError);
  }
}
```

- **Minor – “Initializing” flag misnamed:** `SignInScreen` uses `useAuthLoading()` as `isInitializing`, so any auth-loading state (including self-triggered loading) disables the form; it also doesn’t observe the intended initialization stage.

```24:37:src/app/(auth)/sign-in.tsx
const isInitializing = useAuthLoading();
...
const isLoading = loading || isInitializing;
```

## Recommendations
- In `useSignIn`, set `state` and `authState` to `success(currentUser)` once Firebase Auth resolves (or to `idle(null)` if you rely solely on `AuthInitializer`), and expose `clearError` for the screen `onRetry`.
- Wire `Screen`’s `onRetry` to a `clearError` handler so users can recover from transient errors without a reload.
- Align `FirestoreAuthRepository.signIn` return type with `IAuthRepository` (either return `void` or change the interface + service typing) and adjust `AuthService.signIn` accordingly.
- Use a specific initialization selector (e.g., `useIsInitializing`) separate from the auth-loading flag triggered by this screen to avoid self-imposed blocking.
- Add tests: (1) sign-in success clears loading; (2) error -> retry clears error; (3) repository return type matches interface.

## Mermaid Diagram
```mermaid
flowchart TD
  A[SignInScreen submit] --> B[useSignIn hook]
  B --> C[authService.signIn]
  C --> D[FirestoreAuthRepository.signIn -> Firebase Auth]
  D --> E[AuthInitializer onAuthStateChanged]
  E --> F[userService.getUser + setAuthStatesuccess]
  F --> G[(auth)/_layout guest guard redirects]
```


