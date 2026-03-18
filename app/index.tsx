import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  ImageBackground,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1d37" />

      <ImageBackground
        source={require('../assets/images/home-background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Simple Dark Overlay */}
        <View style={styles.overlay} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appTitle}>SUJATA</Text>
            <View style={styles.divider} />
            <Text style={styles.appSubtitle}>Naval Operations</Text>
          </View>

          {/* Center Glass Card */}
          <View style={styles.centerContent}>
            <View style={styles.glassCard}>
              <Text style={styles.welcomeText}>Welcome Aboard</Text>
              <Text style={styles.descriptionText}>
                Secure access to naval inventory{'\n'}and maintenance systems
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => router.push('/Login')}
              style={styles.primaryButton}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>SIGN IN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Register New Vessel</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2026 SUJATA Systems • v1.0
            </Text>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 29, 55, 0.7)', // Navy blue overlay
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: height > 800 ? 80 : 60,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 56,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginVertical: 12,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginVertical: 20,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    width: '100%',
    maxWidth: 380,
  },
  welcomeText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  descriptionText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  actions: {
    alignItems: 'center',
    gap: 14,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e88e5',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});