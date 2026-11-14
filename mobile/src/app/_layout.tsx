import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Kiekvienas failas src/app aplanke tampa programėlės ekranu.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack />
    </>
  );
}