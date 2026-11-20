import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { isGameServer, normalizeServerUrl } from '../net/config';
import { Panel, PixelButton, PixelInput, PixelText, palette } from '../pixel/ui';

interface Props {
  serverUrl: string;
  /** Called with an address that has just answered as a game server. */
  onChange: (url: string) => Promise<void>;
  style?: StyleProp<ViewStyle>;
}

/** Shows which game server the app talks to, and lets the player point it at another one. */
export function ServerSetting({ serverUrl, onChange, style }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const save = async () => {
    const url = normalizeServerUrl(draft);
    if (!url) return setMessage({ text: 'ENTER AN ADDRESS LIKE 192.168.1.20:8787', bad: true });
    setBusy(true);
    setMessage(null);
    // Only switch to an address that really is a game server, so a typo cannot strand the app.
    if (await isGameServer(url)) {
      await onChange(url);
      setEditing(false);
      setMessage({ text: 'SERVER SAVED.', bad: false });
    } else {
      setMessage({ text: 'NO GAME SERVER ANSWERED THERE. CHECK THE ADDRESS AND THAT THE SERVER IS RUNNING.', bad: true });
    }
    setBusy(false);
  };

  return (
    <Panel style={style} testID="server-setting">
      <PixelText size={10} center>
        GAME SERVER
      </PixelText>
      <PixelText size={8} color={palette.muted} center testID="server-url">
        {serverUrl}
      </PixelText>
      {editing ? (
        <>
          <PixelInput
            testID="server-input"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setMessage(null);
            }}
            placeholder="192.168.1.20:8787"
            autoCapitalize="none"
            autoComplete="off"
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="Game server address"
            style={{ fontSize: 10 }}
          />
          <PixelButton label={busy ? 'CHECKING...' : 'SAVE'} size="sm" testID="server-save" disabled={busy} onPress={save} />
          <PixelButton label="CANCEL" size="sm" color="grey" testID="server-cancel" disabled={busy} onPress={() => setEditing(false)} />
        </>
      ) : (
        <PixelButton
          label="CHANGE SERVER"
          size="sm"
          color="grey"
          testID="server-change"
          onPress={() => {
            setDraft('');
            setMessage(null);
            setEditing(true);
          }}
        />
      )}
      {message && (
        <View accessibilityLiveRegion="polite">
          <PixelText size={8} color={message.bad ? palette.lose : palette.win} center testID="server-message">
            {message.text}
          </PixelText>
        </View>
      )}
    </Panel>
  );
}
