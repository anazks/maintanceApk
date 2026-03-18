import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';

// Safely attempt to require ViewShot
let ViewShot: any = null;
try {
  ViewShot = require('react-native-view-shot').default;
} catch (e) {
  console.warn('ViewShot native module not found, using fallbacks.');
}


interface Equipment {
  id: number;
  equipment_id: string;
  name: string;
  section: string;
  location: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  installation_date: string;
  status: string;
  last_maintenance?: string;
  created_at?: string;
}

export default function EquipmentList() {
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // QR Modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQRData] = useState({ id: '', name: '' });
  const qrRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadEquipment();
    }, [])
  );

  // Filter equipment when search query, filter, or equipment changes
  useEffect(() => {
    filterEquipment();
  }, [searchQuery, selectedFilter, equipment]);

  const loadEquipment = () => {
    setLoading(true);
    try {
      const db = getDB();
      const allEquipment = db.getAllSync('SELECT * FROM Equipment ORDER BY created_at DESC');
      setEquipment(allEquipment as any);
      setFilteredEquipment(allEquipment as any);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEquipment = () => {
    let filtered = [...equipment];

    // Apply status filter
    if (selectedFilter !== 'All') {
      filtered = filtered.filter(item => item.status === selectedFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.equipment_id.toLowerCase().includes(query) ||
        item.section.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
      );
    }

    setFilteredEquipment(filtered);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // Reload actual data instead of setting dummy content
    loadEquipment();
    setRefreshing(false);
  };

  // Function to get status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#10B981';
      case 'Under Maintenance': return '#F59E0B';
      case 'Maintenance': return '#F59E0B';
      case 'Inactive': return '#6B7280';
      case 'Retired': return '#EF4444';
      default: return '#2563EB'; // Blue for custom
    }
  };

  const getStatusBackgroundColor = (status: string) => {
    switch (status) {
      case 'Active': return '#D1FAE5';
      case 'Under Maintenance': return '#FEF3C7';
      case 'Maintenance': return '#FEF3C7';
      case 'Inactive': return '#F3F4F6';
      case 'Retired': return '#FEE2E2';
      default: return '#EFF6FF'; // Light blue for custom
    }
  };

  const handleOpenQR = (item: Equipment) => {
    setQRData({ id: item.equipment_id, name: item.name });
    setShowQRModal(true);
  };

  const handleDownloadQR = async () => {
    try {
      // Try using ViewShot first (requires native rebuild)
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        await Sharing.shareAsync(uri);
        return;
      }
    } catch (error) {
      console.warn('ViewShot failed, falling back to Print/QRCode:', error);
    }

    // Fallback: Using expo-print to generate a PDF with border and name
    // This works in Expo Go and doesn't require a rebuild if expo-print is already present.
    if (qrRef.current) {
      qrRef.current.toDataURL(async (data: string) => {
        try {
          const html = `
            <html>
              <head>
                <style>
                  body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                  .container { border: 2px solid #e2e8f0; padding: 40px; border-radius: 20px; text-align: center; background: white; }
                  .id { margin-top: 20px; font-size: 24px; font-weight: bold; font-family: monospace; }
                  .name { margin-top: 10px; font-size: 20px; color: #374151; }
                  .caption { margin-top: 15px; font-size: 14px; color: #6b7280; }
                </style>
              </head>
              <body>
                <div class="container">
                  <img src="data:image/png;base64,${data}" style="width: 300px; height: 300px;" />
                  <div class="id">${qrData.id}</div>
                  <div class="name">${qrData.name}</div>
                  <div class="caption">Scan to view equipment details</div>
                </div>
              </body>
            </html>
          `;
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Download QR Code' });
        } catch (printError) {
          console.error('Print fallback failed:', printError);
          // Last resort: Save just the QR image base64
          const filePath = `${FileSystem.documentDirectory}QR_${qrData.id}.png`;
          await FileSystem.writeAsStringAsync(filePath, data, { encoding: FileSystem.EncodingType.Base64 });
          await Sharing.shareAsync(filePath);
        }
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading equipment...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATA Fleet</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Equipment Inventory & Status</Text>
          </View>
          <TouchableOpacity
            style={[styles.addButtonSmall, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}
            onPress={() => router.push('/add-equipment')}
          >
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search by name, ID, section..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {['All', 'Active', 'Under Maintenance', 'Inactive', 'Retired'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  selectedFilter === filter && [styles.filterChipActive, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: theme.colors.textSecondary },
                    selectedFilter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Summary */}
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{equipment.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {equipment.filter(e => e.status === 'Active').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Active</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {equipment.filter(e => e.status === 'Under Maintenance' || e.status === 'Maintenance').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Maintenance</Text>
          </View>
        </View>

        {/* Equipment List */}
        <FlatList
          data={filteredEquipment}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => router.push({
                pathname: '/equipment-details',
                params: { id: item.id }
              })}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.idContainer}>
                  <Text style={[styles.equipmentId, { color: theme.colors.primary }]}>{item.equipment_id}</Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: theme.dark 
                      ? (item.status === 'Active' ? '#064e3b' 
                        : (item.status === 'Inactive' ? '#374151' 
                          : (item.status === 'Retired' ? '#7f1d1d' 
                            : (item.status === 'Under Maintenance' || item.status === 'Maintenance' ? '#451a03' : '#1e3a8a')))) 
                      : getStatusBackgroundColor(item.status) 
                  }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => handleOpenQR(item)}
                    style={[styles.qrButton, { backgroundColor: theme.dark ? '#1e293b' : '#f8fafc' }]}
                  >
                    <Ionicons name="qr-code-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </View>
              </View>

              <Text style={[styles.equipmentName, { color: theme.colors.text }]}>{item.name}</Text>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="layers-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{item.section}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{item.location}</Text>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.colors.border }]}>
                <View style={styles.manufacturerContainer}>
                  <Ionicons name="business-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.manufacturerText, { color: theme.colors.textSecondary }]}>{item.manufacturer}</Text>
                </View>
                <Text style={[styles.maintenanceText, { color: theme.colors.textSecondary }]}>
                  Last: {item.last_maintenance}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={theme.colors.border} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Equipment Found</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Add your first equipment to get started'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => router.push('/add-equipment')}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Add Equipment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      {/* QR Code Modal */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Equipment QR Code</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>{qrData.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {ViewShot ? (
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                <View style={[styles.qrContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.qrBorder}>
                    <QRCode
                      value={qrData.id}
                      size={220}
                      getRef={(c) => (qrRef.current = c)}
                      color={theme.dark ? '#FFFFFF' : '#111827'}
                      backgroundColor={theme.colors.surface}
                    />
                  </View>
                  <Text style={[styles.qrCodeId, { color: theme.colors.text }]}>{qrData.id}</Text>
                  <Text style={[styles.qrCodeName, { color: theme.colors.text }]}>{qrData.name}</Text>
                  <Text style={[styles.qrCaption, { color: theme.colors.textSecondary }]}>Scan to view equipment details</Text>
                </View>
              </ViewShot>
            ) : (
              <View style={[styles.qrContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.qrBorder}>
                  <QRCode
                    value={qrData.id}
                    size={220}
                    getRef={(c) => (qrRef.current = c)}
                    color={theme.dark ? '#FFFFFF' : '#111827'}
                    backgroundColor={theme.colors.surface}
                  />
                </View>
                <Text style={[styles.qrCodeId, { color: theme.colors.text }]}>{qrData.id}</Text>
                <Text style={[styles.qrCodeName, { color: theme.colors.text }]}>{qrData.name}</Text>
                <Text style={[styles.qrCaption, { color: theme.colors.textSecondary }]}>Scan to view equipment details</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.downloadButton, { backgroundColor: theme.colors.primary }]} onPress={handleDownloadQR}>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>Save QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8, // Drastically reduced
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  headerSubtitle: {
    fontSize: 10,
    marginTop: 0,
  },
  addButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 30,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#111827',
    paddingVertical: 2,
  },
  filterContainer: {
    paddingBottom: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipActive: {
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 0,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  card: {
    borderRadius: 12,
    padding: 10, // Reduced from 16
    marginBottom: 8, // Reduced from 12
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4, // Reduced from 8
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6, // Reduced from 12
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6, // Reduced from 12
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#4B5563',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  manufacturerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manufacturerText: {
    fontSize: 12,
    color: '#6B7280',
  },
  maintenanceText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qrButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  qrContainer: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  qrBorder: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  qrCodeId: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrCodeName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrCaption: {
    marginTop: 8,
    fontSize: 13,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    width: '100%',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});