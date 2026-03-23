import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { handleMessage } from '../../services/chatService';
import { useTheme } from '../../context/ThemeContext';
import { useLocalSearchParams } from 'expo-router';

export default function ChatScreen() {
  const { equipmentContext } = useLocalSearchParams<{ equipmentContext: string }>();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<{ id: string; user?: string; bot?: string }[]>([]);
  const [inputText, setInputText] = useState('');

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setInputText('');
    
    // Optimistic user message + loading bot message
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + 'u', user: userMsg },
      { id: Date.now().toString() + 'b_loading', bot: "Thinking..." },
    ]);

    try {
      const reply = await handleMessage(userMsg, equipmentContext);
      setMessages((prev) => prev.map(msg => 
          msg.id.endsWith('b_loading') ? { ...msg, id: Date.now().toString() + 'b', bot: reply } : msg
      ));
    } catch (e) {
      setMessages((prev) => prev.map(msg => 
          msg.id.endsWith('b_loading') ? { ...msg, id: Date.now().toString() + 'b', bot: "An error occurred." } : msg
      ));
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    if (item.user) {
      return (
        <View style={[styles.messageBubble, styles.userBubble, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.userText}>{item.user}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.botText, { color: theme.colors.text }]}>{item.bot}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContainer}
      />
      <View style={[styles.inputContainer, { borderTopColor: theme.colors.border }]}>
        <TextInput
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="Describe your issue..."
          placeholderTextColor={theme.colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: theme.colors.primary }]} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { padding: 16 },
  messageBubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userText: { color: '#ffffff', fontSize: 16 },
  botText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, fontSize: 16, marginRight: 8, minHeight: 40 },
  sendButton: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 20 },
  sendText: { color: '#ffffff', fontWeight: 'bold' },
});
