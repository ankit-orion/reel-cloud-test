import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ROOM_CODE_LENGTH } from '../../shared/protocol';
import type { RoomLink } from '../net/useRoom';
import { SkyScene } from '../pixel/scenes';
import { Panel, PixelButton, PixelInput, PixelText, palette } from '../pixel/ui';
import { Header } from './Header';

interface Props {
  link: RoomLink;
  onBack: () => void;
}

/** Invite a friend with a room code, or join theirs. The match screen takes over once both are in. */
export function Friend({ link, onBack }: Props) {
  const { room, status, error, clearError } = link;
  const [code, setCode] = useState('');
  const online = status === 'online';

  // An old error should not greet the player when they come back to this screen.
  useEffect(() => clearError, [clearError]);

  const share = (roomCode: string) => {
    Share.share({
      message: `Play Rock Paper Scissors with me! Open the app, tap PLAY A FRIEND and enter room code ${roomCode}`,
    }).catch(() => {
      // No share sheet here (some browsers): the code is on screen to read out instead.
    });
  };

  return (
    <SkyScene>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Header title="PLAY A FRIEND" onBack={onBack} />

          {status === 'replaced' ? (
            <Panel testID="replaced">
              <PixelText size={10} center>
                YOU ARE PLAYING ON ANOTHER DEVICE OR TAB.
              </PixelText>
              <PixelButton label="PLAY HERE" onPress={link.reconnect} />
            </Panel>
          ) : room?.status === 'waiting' ? (
            <Panel testID="waiting-room">
              <PixelText size={10} color={palette.muted} center>
                ROOM CODE
              </PixelText>
              <PixelText size={30} center testID="room-code" style={styles.code}>
                {room.code}
              </PixelText>
              <PixelText size={10} color={palette.muted} center>
                {online ? 'WAITING FOR YOUR FRIEND TO JOIN...' : 'RECONNECTING...'}
              </PixelText>
              <PixelButton label="SHARE INVITE" testID="share" onPress={() => share(room.code)} />
              <PixelButton label="CANCEL" color="grey" size="sm" testID="cancel-room" onPress={link.leave} />
            </Panel>
          ) : (
            <>
              <Panel>
                <PixelText size={12} center>
                  INVITE A FRIEND
                </PixelText>
                <PixelText size={9} color={palette.muted} center>
                  GET A ROOM CODE TO SEND THEM.
                </PixelText>
                <PixelButton label="CREATE ROOM" testID="create-room" disabled={!online} onPress={link.create} />
              </Panel>
              <Panel>
                <PixelText size={12} center>
                  GOT A CODE?
                </PixelText>
                <PixelInput
                  testID="code-input"
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    clearError();
                  }}
                  placeholder="ROOM CODE"
                  maxLength={ROOM_CODE_LENGTH}
                  autoCapitalize="characters"
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={() => code.length === ROOM_CODE_LENGTH && link.join(code)}
                  accessibilityLabel="Room code"
                />
                <PixelButton
                  label="JOIN ROOM"
                  color="green"
                  testID="join-room"
                  disabled={!online || code.length !== ROOM_CODE_LENGTH}
                  onPress={() => link.join(code)}
                />
              </Panel>
            </>
          )}

          <View style={styles.message} accessibilityLiveRegion="polite">
            <PixelText size={10} color={palette.white} shadow={palette.ink} center testID="friend-message">
              {(error ?? (status === 'connecting' ? 'CONNECTING TO SERVER...' : '')).toUpperCase()}
            </PixelText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SkyScene>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: 20, gap: 20, width: '100%', maxWidth: 420, alignSelf: 'center' },
  code: { letterSpacing: 4 },
  message: { minHeight: 34, justifyContent: 'center' },
});
