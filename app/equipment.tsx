import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react'; // Added useEffect
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDB } from '../database';

// Sample data
const SAMPLE_EQUIPMENT: Equipment[] = [
  {
    id: 1,
    equipment_id: 'EQP-001',
    name: 'Cooling Pump',
    section: 'Water Treatment',
    location: 'Plant Room 2',
    manufacturer: 'Siemens',
    model_number: 'SPM-450',
    serial_number: 'SN239482',
    installation_date: '2023-05-20',
    status: 'Active',
    last_maintenance: '2024-01-15',
  },
  {
    id: 2,
    equipment_id: 'EQP-002',
    name: 'Hydraulic Press',
    section: 'Manufacturing',
    location: 'Production Hall A',
    manufacturer: 'Bosch',
    model_number: 'HP-3000',
    serial_number: 'SN873421',
    installation_date: '2023-08-10',
    status: 'Maintenance',
    last_maintenance: '2024-02-01',
  },
  {
    id: 3,
    equipment_id: 'EQP-003',
    name: 'Conveyor Belt',
    section: 'Packaging',
    location: 'Line 3',
    manufacturer: 'Festo',
    model_number: 'CB-200',
    serial_number: 'SN456782',
    installation_date: '2023-11-05',
    status: 'Active',
    last_maintenance: '2024-01-28',
  },
  {
    id: 4,
    equipment_id: 'EQP-004',
    name: 'Air Compressor',
    section: 'Utilities',
    location: 'Machine Room',
    manufacturer: 'Atlas Copco',
    model_number: 'AC-150',
    serial_number: 'SN982345',
    installation_date: '2023-03-15',
    status: 'Inactive',
    last_maintenance: '2023-12-10',
  },
  {
    id: 5,
    equipment_id: 'EQP-005',
    name: 'CNC Machine',
    section: 'Machining',
    location: 'Workshop B',
    manufacturer: 'Haas',
    model_number: 'VF-2',
    serial_number: 'SN567890',
    installation_date: '2023-09-22',
    status: 'Active',
    last_maintenance: '2024-02-05',
  },
  {
    id: 6,
    equipment_id: 'EQP-006',
    name: 'Industrial Fan',
    section: 'Ventilation',
    location: 'Roof Level',
    manufacturer: 'Greenheck',
    model_number: 'IF-75',
    serial_number: 'SN123456',
    installation_date: '2023-12-01',
    status: 'Maintenance',
    last_maintenance: '2024-01-20',
  },
];

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadEquipment();
  }, []);

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
    setTimeout(() => {
      setEquipment(SAMPLE_EQUIPMENT);
      setRefreshing(false);
    }, 1000);
  };

  // Function to get status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#10B981';
      case 'Under Maintenance': return '#F59E0B';
      case 'Maintenance': return '#F59E0B';
      case 'Inactive': return '#6B7280';
      case 'Retired': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusBackgroundColor = (status: string) => {
    switch (status) {
      case 'Active': return '#D1FAE5';
      case 'Under Maintenance': return '#FEF3C7';
      case 'Maintenance': return '#FEF3C7';
      case 'Inactive': return '#F3F4F6';
      default: return '#FEE2E2';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading equipment...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={{flex: 1, marginLeft: 16}}>
            <Text style={styles.brandTitle}>SUJATHA Fleet</Text>
            <Text style={styles.headerSubtitle}>Equipment Inventory & Status</Text>
          </View>
          <TouchableOpacity
            style={styles.addButtonSmall}
            onPress={() => router.push('/add-equipment')}
          >
            <Ionicons name="add" size={24} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID, section..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {['All', 'Active', 'Under Maintenance', 'Inactive'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
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
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{equipment.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {equipment.filter(e => e.status === 'Active').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {equipment.filter(e => e.status === 'Under Maintenance' || e.status === 'Maintenance').length}
            </Text>
            <Text style={styles.statLabel}>Maintenance</Text>
          </View>
        </View>

        {/* Equipment List */}
        <FlatList
          data={filteredEquipment}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({
                pathname: '/equipment-details',
                params: { id: item.id }
              })}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.idContainer}>
                  <Text style={styles.equipmentId}>{item.equipment_id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBackgroundColor(item.status) }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>

              <Text style={styles.equipmentName}>{item.name}</Text>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="layers-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{item.section}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.manufacturerContainer}>
                  <Ionicons name="business-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.manufacturerText}>{item.manufacturer}</Text>
                </View>
                <Text style={styles.maintenanceText}>
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
              <Ionicons name="cube-outline" size={64} color="#E5E7EB" />
              <Text style={styles.emptyStateTitle}>No Equipment Found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Add your first equipment to get started'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.addButton}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  addButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 8,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
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
    color: '#111827',
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
});