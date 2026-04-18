# droponair-demo-ionic

Ionic Angular 19 + Capacitor 6 demo app that shows how to integrate `@droponair/sdk-js`.

Runs in the browser for development, and on Android/iOS via Capacitor for native testing.

## What it demonstrates

- Login via the `droponair-demo-backend` (JWT issued on `/api/auth/login`)
- Initialising `@droponair/sdk-js` with a token-exchange URL
- Connecting as a user and receiving messages using Angular signals
- Sending end-to-end-encrypted text messages in a chat UI

## Requirements

- Node.js 20+  
- The `droponair-demo-backend` running on `localhost:8180`

## Run in browser

```bash
cd droponair-demo-ionic
npm install
npm start            # http://localhost:4202
```

## Run on device via Capacitor

```bash
npm run build
npm run cap:sync
npm run cap:android  # or cap:ios
```

## Configuration

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  droponairAppId:        'YOUR_APP_ID',
  droponairPublicApiKey: 'YOUR_PUBLIC_API_KEY',
  backendUrl: 'http://localhost:8180',
};
```

## Architecture

```
AppComponent     , IonApp root
  LoginPage      , userId form → AuthService.login() + ChatService.connect()
  ChatPage       , messages list + input bar driven by ChatService signals
    AuthService  , HTTP login, returns JWT
    ChatService  , wraps @droponair/sdk-js, exposes Angular signals
```
