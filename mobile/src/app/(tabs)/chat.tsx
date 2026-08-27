import { useState, useEffect, useRef } from "react";
import Markdown from "react-native-markdown-display";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { sendChatMessage, getChatHistory } from "../../services/api";
import { colors } from "../../theme";
import { common } from "../../styles/common";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getChatHistory();
      setMessages(data.messages);
    } catch (err) {
      // prazna istorija je u redu za prvi put
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setSending(true);

    try {
      const data = await sendChatMessage(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Greška pri slanju poruke. Pokušaj ponovo." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (loadingHistory) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={common.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            {item.role === "assistant" ? (
              <Markdown style={markdownStyles}>{item.content}</Markdown>
            ) : (
              <Text style={styles.bubbleText}>{item.content}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={common.emptyText}>Pitaj me bilo šta o svom planu, receptima, ili profilu 👋</Text>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Napiši poruku..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator size="small" color="#141414" />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messagesList: { padding: 16, paddingBottom: 20 },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 14, marginBottom: 10 },
  userBubble: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  bubbleText: { color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "#141414", fontSize: 18, fontWeight: "700" },
});

const markdownStyles = {
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
  strong: { fontWeight: "700" as const, color: colors.textPrimary },
  em: { fontStyle: "italic" as const },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  paragraph: { marginTop: 0, marginBottom: 4 },
  code_inline: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 4,
    color: colors.textPrimary,
  },
};