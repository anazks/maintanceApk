import { router } from 'expo-router';
import React, { useState } from 'react';
import {
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

const { height } = Dimensions.get('window');

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    console.log('Login attempt:', { username, password });
  };

  const isFormValid = username.trim() !== '' && password.trim() !== '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1e3a" />

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
            <Text style={styles.appTitle}>SUJATHA</Text>
            <Text style={styles.appSubtitle}>Naval Operations</Text>

            {/* Login Form */}
            <View style={styles.form}>
              <Text style={styles.title}>Sign In</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={true}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  !isFormValid && styles.loginButtonDisabled,
                ]}
                onPress={() => router.push('/(tabs)')}
                disabled={!isFormValid}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>LOGIN</Text>
              </TouchableOpacity>

              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>New to SUJATHA? </Text>
                <TouchableOpacity>
                  <Text style={styles.registerLink}>Register</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <Text style={styles.footerText}>
              Naval Inventory System • v1.0
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
    backgroundColor: '#0a1d37', // Solid dark navy background
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
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#a0c4ff',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 48,
    textTransform: 'uppercase',
  },
  form: {
    backgroundColor: '#1e3456', // Solid slightly lighter navy
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2e4466',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#c0d4ff',
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a4062',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a5072',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    color: '#90caf9',
    fontSize: 13,
  },
  loginButton: {
    backgroundColor: '#1e6ae5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3e7af5',
  },
  loginButtonDisabled: {
    backgroundColor: '#2a4072',
    borderColor: '#3a5082',
  },
  buttonText: {
    color: 'white',
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
    color: '#a0b4d0',
    fontSize: 14,
  },
  registerLink: {
    color: '#90caf9',
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    color: '#7088a8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
});