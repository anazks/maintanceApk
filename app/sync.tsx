import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { SyncService } from '../services/SyncService';

// Native P2P Modules (Optional imports to avoid crashes on web/unsupported)
let WifiP2P: any = null;
let BleManager: any = null;

if (Platform.OS === 'android') {
  try {
    WifiP2P = require('react-native-wifi-p2p');
  } catch (e) {}
}

try {
  const { BleManager: Ble } = require('react-native-ble-plx');
  BleManager = new Ble();
} catch (e) {}

interface Peer {
  id: string;
  name: string;
  type: 'wifi' | 'bluetooth';
  address?: string;
}

export default function SyncScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [isSearching, setIsSearching] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Initialize P2P permissions and status
    if (Platform.OS === 'android' && WifiP2P) {
      WifiP2P.initialize();
    }
    
    return () => {
      if (isSearching) stopSearch();
    };
  }, []);

  const startSearch = async () => {
    setIsSearching(true);
    setPeers([]);

    // 1. Search via Wi-Fi Direct (Android only)
    if (Platform.OS === 'android' && WifiP2P) {
      try {
        await WifiP2P.subscribeOnPeersUpdates((event: any) => {
          const newPeers = event.devices.map((d: any) => ({
            id: d.deviceAddress,
            name: d.deviceName || 'Unknown Wi-Fi Device',
            type: 'wifi',
            address: d.deviceAddress,
          }));
          setPeers(prev => [...prev.filter(p => p.type !== 'wifi'), ...newPeers]);
        });
        await WifiP2P.discoverPeers();
      } catch (err) {
        console.warn('Wi-Fi Direct discovery failed', err);
      }
    }

    // 2. Search via Bluetooth
    if (BleManager) {
      BleManager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          console.warn('Bluetooth scan failed', error);
          return;
        }
        if (device && device.name) {
          const newPeer: Peer = {
            id: device.id,
            name: device.name,
            type: 'bluetooth',
          };
          setPeers(prev => {
            if (prev.find(p => p.id === device.id)) return prev;
            return [...prev, newPeer];
          });
        }
      });
    }

    // Stop searching after 30 seconds
    setTimeout(() => stopSearch(), 30000);
  };

  const stopSearch = () => {
    setIsSearching(false);
    if (BleManager) BleManager.stopDeviceScan();
    if (Platform.OS === 'android' && WifiP2P) {
       // Unsubscribe logic depends on lib version, but usually discoverPeers stops
    }
  };

  const handleSync = async (peer: Peer) => {
    setSyncStatus('syncing');
    try {
      // Logic for P2P Data Exchange:
      // 1. Establish connection to Peer (simplified for this mock/example)
      // 2. Export local data
      const localData = await SyncService.exportData('This Device');
      
      // 3. Send data to peer & receive peer data
      // (In a real implementation, you'd use WifiP2P.sendServer/sendClient or BLE characteristic writes)
      // For this demonstration, we'll simulate receiving data
      console.log(`Syncing with ${peer.name} via ${peer.type}...`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Merge received data
      // await SyncService.importData(receivedData);

      setSyncStatus('success');
      Alert.alert('Sync Complete', `Data has been synchronized with ${peer.name}.`);
    } catch (err) {
      setSyncStatus('error');
      Alert.alert('Sync Failed', 'An error occurred during data synchronization.');
      console.error(err);
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const renderPeer = ({ item }: { item: Peer }) => (
    <TouchableOpacity 
      style={[styles.peerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => handleSync(item)}
    >
      <View style={[styles.peerIcon, { backgroundColor: item.type === 'wifi' ? '#EFF6FF' : '#F5F3FF' }]}>
        <Ionicons 
          name={item.type === 'wifi' ? 'wifi' : 'bluetooth'} 
          size={24} 
          color={item.type === 'wifi' ? '#2563EB' : '#7C3AED'} 
        />
      </View>
      <View style={styles.peerInfo}>
        <Text style={[styles.peerName, { color: theme.colors.text }]}>{item.name}</Text>
        <Text style={[styles.peerDetail, { color: theme.colors.textSecondary }]}>
          {item.type === 'wifi' ? 'Wi-Fi Direct' : 'Bluetooth'} • Nearby
        </Text>
      </View>
      <Ionicons name="sync-outline" size={20} color={theme.colors.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Data Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.statusCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statusRow}>
            <View>
              <Text style={[styles.statusTitle, { color: theme.colors.text }]}>Discoverable</Text>
              <Text style={[styles.statusSub, { color: theme.colors.textSecondary }]}>Allow others to find this device</Text>
            </View>
            <Switch 
              value={isDiscoverable} 
              onValueChange={setIsDiscoverable}
              trackColor={{ false: '#D1D5DB', true: theme.colors.primary }}
            />
          </View>
        </View>

        <View style={styles.searchHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>NEARBY DEVICES</Text>
          {isSearching ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <TouchableOpacity onPress={startSearch}>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={peers}
          renderItem={renderPeer}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={64} color="#D1D5DB" />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {isSearching ? 'Searching for devices...' : 'No devices found nearby.\nTap Refresh to start searching.'}
              </Text>
            </View>
          }
        />

        {syncStatus === 'syncing' && (
          <View style={styles.syncOverlay}>
            <View style={[styles.syncModal, { backgroundColor: theme.colors.surface }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.syncText, { color: theme.colors.text }]}>Synchronizing Data...</Text>
              <Text style={[styles.syncSubText, { color: theme.colors.textSecondary }]}>Please keep both devices close</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusSub: {
    fontSize: 13,
    marginTop: 2,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  peerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  peerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  peerDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  syncOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  syncModal: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
  },
  syncText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
  },
  syncSubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
