import { PressStart2P_400Regular, useFonts } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CpuGame } from './src/game/CpuGame';
import { OnlineGame } from './src/game/OnlineGame';
import { useRoom } from './src/net/useRoom';
import { useSession, visibleProfile } from './src/net/useSession';
import { palette } from './src/pixel/ui';
import { Friend } from './src/screens/Friend';
import { Home } from './src/screens/Home';
import { Leaderboard } from './src/screens/Leaderboard';
import { Onboarding } from './src/screens/Onboarding';
import { ProfileScreen } from './src/screens/ProfileScreen';

type Screen = 'home' | 'friend' | 'computer' | 'leaderboard' | 'profile';

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const { session, serverUrl, register, setProfile, recordCpuMatch, refresh, signOut, changeServer } = useSession();
  const [screen, setScreen] = useState<Screen>('home');

  const onAuthLost = useCallback(() => signOut('Your player was not found. Pick a name again.'), [signOut]);
  const token = session.status === 'signedIn' ? session.token : null;
  const link = useRoom(token, serverUrl, { onProfile: setProfile, onAuthLost });
  const { room, leave } = link;

  const goHome = useCallback(() => setScreen('home'), []);
  const leaveRoom = useCallback(() => {
    leave();
    setScreen('home');
  }, [leave]);

  // A match in progress owns the screen (and handles "back" itself); otherwise back means Home.
  const inMatch = room !== null && room.status !== 'waiting';
  useEffect(() => {
    if (inMatch || screen === 'home' || screen === 'computer') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen('home');
      return true;
    });
    return () => subscription.remove();
  }, [inMatch, screen]);

  let content = null;
  if (!fontsLoaded || session.status === 'loading') {
    // Nothing is drawn until the pixel font and the saved player are ready, so neither pops in.
  } else if (session.status === 'signedOut') {
    content = (
      <Onboarding notice={session.notice} onRegister={register} serverUrl={serverUrl} onChangeServer={changeServer} />
    );
  } else if (inMatch) {
    content = <OnlineGame room={room} link={link} onExit={leaveRoom} />;
  } else {
    const profile = visibleProfile(session);
    if (screen === 'friend') content = <Friend link={link} onBack={goHome} />;
    else if (screen === 'computer') {
      content = <CpuGame playerName={profile.name} onMatchEnd={recordCpuMatch} onExit={goHome} />;
    } else if (screen === 'leaderboard') content = <Leaderboard profile={profile} onBack={goHome} />;
    else if (screen === 'profile') {
      content = (
        <ProfileScreen
          profile={profile}
          onRefresh={refresh}
          onBack={goHome}
          serverUrl={serverUrl}
          onChangeServer={changeServer}
        />
      );
    }
    else {
      content = (
        <Home
          profile={profile}
          onPlayFriend={() => setScreen('friend')}
          onPlayComputer={() => setScreen('computer')}
          onLeaderboard={() => setScreen('leaderboard')}
          onProfile={() => setScreen('profile')}
        />
      );
    }
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {content}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.sky },
});
