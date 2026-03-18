import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';

const { height } = Dimensions.get('window');

export default function Login() {
  const { theme, isDarkMode } = useTheme();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;

    setIsLoggingIn(true);
    try {
      const db = getDB();
      const user = db.getFirstSync<{ id: number; username: string; password: string; role: string }>(
        'SELECT * FROM Users WHERE username = ?',
        [username.trim()]
      );

      if (user && user.password === password) {
        await login({
          id: user.id,
          username: user.username,
          role: user.role as 'Admin' | 'Staff'
        });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', 'Invalid username or password');
      }
    } catch (e) {
      console.error('Login error:', e);
      Alert.alert('Error', 'An error occurred during login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isFormValid = username.trim() !== '' && password.trim() !== '' && !isLoggingIn;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerContainer}>
            {/* App Name */}
            <Text style={[styles.appTitle, { color: theme.colors.primary }]}>SUJATA</Text>
            <Text style={[styles.appSubtitle, { color: theme.colors.textSecondary }]}>Naval Operations</Text>

            {/* Login Form */}
            <View style={[styles.form, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Sign In</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Username</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter username"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={true}
                  autoCapitalize="none"
                />
              </View>

             

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  !isFormValid && [styles.loginButtonDisabled, { backgroundColor: theme.colors.border, borderColor: theme.colors.border }],
                ]}
                onPress={handleLogin}
                disabled={!isFormValid}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {isLoggingIn ? 'LOGGING IN...' : 'LOGIN'}
                </Text>
              </TouchableOpacity>

              <View style={styles.registerContainer}>
                <Text style={[styles.registerText, { color: theme.colors.textSecondary }]}>Logged-in as staff? </Text>
                <TouchableOpacity>
                  <Text style={[styles.registerLink, { color: theme.colors.primary }]}>Help</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              © 2026 SUJATA Fleet Management • v1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 48,
    textTransform: 'uppercase',
  },
  form: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    fontSize: 13,
  },
  loginButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  loginButtonDisabled: {
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
});