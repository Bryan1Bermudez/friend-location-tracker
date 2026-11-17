# Friend Location Tracker
bababowe
An Android app for sharing your live location with friends. Each phone gets a
short ID. You add friends by their ID, and their positions show up as pins on
a map.

Built with React Native, Expo, TypeScript and Firebase (Realtime Database and
anonymous auth). Spring 2026.

## Features

- **Live location:** the app asks for location permission, watches the
  phone's GPS, and writes its coordinates to Firebase every 5 seconds.
- **Anonymous IDs:** each install generates a random ID, stored on the device
  with AsyncStorage. No account is needed.
- **Friends list:** add or remove friends by ID and name. The list is saved
  on the device.
- **Map view:** friends appear as pins on a `react-native-maps` map. A **Find
  Me** button recenters the map on you.
- **Directions:** a button next to each friend opens Google Maps with driving
  directions to their location.
- **Builds:** EAS build profiles produce an installable Android APK
  (`eas build -p android --profile preview`).

The main logic is in `app/(tabs)/index.tsx`. The rest is the Expo Router
starter layout.

## Running it

1. `npm install`
2. Create a Firebase project and enable **Realtime Database** and
   **Anonymous** sign-in.
3. Copy `app/firebaseConfig.example.js` to `app/firebaseConfig.js` and fill in
   your project's keys. The real file is git-ignored.
4. Put a Google Maps Android API key in `app.json`, under
   `android.config.googleMaps.apiKey`.
5. `npx expo run:android`, or build an APK with EAS.

## Limitations

- Any app that knows an ID can read that location. There are no friend
  requests or database security rules beyond anonymous sign-in. A real
  release would need both.
- Location only updates while the app is open, since it doesn't run in the
  background.
