import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { NAME_MAX_LENGTH, nameProblem } from '../../shared/protocol';
import { ApiError } from '../net/api';
import { SkyScene } from '../pixel/scenes';
import { Panel, PixelButton, PixelInput, PixelText, palette } from '../pixel/ui';
import { ServerSetting } from './ServerSetting';
import { Title } from './Title';

interface Props {
  /** Why the player is back here, if they had a profile before. */
  notice: string | null;
  onRegister: (name: string) => Promise<void>;
  serverUrl: string;
  onChangeServer: (url: string) => Promise<void>;
}

export function Onboarding({ notice, onRegister, serverUrl, onChangeServer }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    const problem = nameProblem(trimmed);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onRegister(trimmed);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <SkyScene ground>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title />
          <Panel style={styles.panel}>
            <PixelText size={12} center>
              PICK A PLAYER NAME
            </PixelText>
            <PixelInput
              testID="name-input"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder="YOUR NAME"
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="none"
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Player name"
            />
            <View style={styles.message} accessibilityLiveRegion="polite">
              <PixelText size={9} color={error ? palette.lose : palette.muted} center testID="name-message">
                {(error ?? notice ?? 'FRIENDS AND THE LEADERBOARD WILL SEE THIS NAME.').toUpperCase()}
              </PixelText>
            </View>
            <PixelButton label={busy ? 'SAVING...' : 'START'} testID="register" disabled={busy} onPress={submit} />
          </Panel>
          <ServerSetting serverUrl={serverUrl} onChange={onChangeServer} style={styles.panel} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SkyScene>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 28 },
  panel: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  message: { minHeight: 28, justifyContent: 'center' },
});
